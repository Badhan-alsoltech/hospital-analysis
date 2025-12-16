const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("✅ MongoDB Connected");
        initializeDatabase();
    })
    .catch(err => console.log(err));

/* ------------------ SCHEMAS ------------------ */

// User Schema (for Login/Admin)
const UserSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true }, // In real app, hash this!
    role: { type: String, enum: ['ADMIN', 'DOCTOR', 'NURSE'], default: 'NURSE' },
    specialty: String
});

// Patient Schema
const PatientSchema = new mongoose.Schema({
    name: String,
    age: Number,
    gender: String,
    diagnosis: String,
    status: { type: String, default: 'Stable' }, // Stable, Critical, Discharged
    admissionDate: { type: Date, default: Date.now },
    assignedBedId: String, // Links to Bed unique ID
    assignedDoctorId: String
});

// Bed Schema
const BedSchema = new mongoose.Schema({
    bedId: { type: String, unique: true }, // e.g., "R10-B1"
    roomNumber: String,
    bedNumber: Number,
    isOccupied: { type: Boolean, default: false },
    currentPatientId: String
});

// Vital Schema
const VitalSchema = new mongoose.Schema({
    bedId: String,
    heartRate: Number,
    spo2: Number,
    temperature: Number,
    respiration: Number,
    timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model("User", UserSchema);
const Patient = mongoose.model("Patient", PatientSchema);
const Bed = mongoose.model("Bed", BedSchema);
const Vital = mongoose.model("Vital", VitalSchema);

/* ------------------ INITIALIZATION ------------------ */

async function initializeDatabase() {
    // 1. Auto-generate Beds for Rooms 10, 209, 304 (10 beds each)
    try {
        const count = await Bed.countDocuments();
        if (count === 0) {
            console.log("🛏️ Initializing Beds...");
            const rooms = ["10", "209", "304"];
            const beds = [];

            rooms.forEach(room => {
                for (let i = 1; i <= 10; i++) {
                    beds.push({
                        bedId: `R${room}-B${i}`,
                        roomNumber: room,
                        bedNumber: i,
                        isOccupied: false,
                        currentPatientId: null
                    });
                }
            });

            await Bed.insertMany(beds);
            console.log("✅ Created 30 Beds for Rooms 10, 209, 304");
        }
    } catch (err) {
        console.log("Bed Init Error:", err);
    }

    // 2. Log Admin Creation Hint
    try {
        const adminExists = await User.findOne({ role: 'ADMIN' });
        if (!adminExists) {
            console.log("⚠️ No Admin User found. Create one via POST /users/register");
        }
    } catch (err) {
        console.log("User Init Error:", err);
    }
}

/* ------------------ APIs ------------------ */

// --- AUTH ---
app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email, password });
    if (user) {
        res.json({ success: true, user });
    } else {
        res.status(401).json({ success: false, message: "Invalid credentials" });
    }
});

app.post("/users/register", async (req, res) => {
    try {
        const user = new User(req.body);
        await user.save();
        res.json({ success: true, message: "User created", user });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

app.get("/users", async (req, res) => {
    const users = await User.find();
    res.json({ success: true, data: users });
});

app.delete("/users/:id", async (req, res) => {
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true });
});

// --- BEDS ---
app.get("/beds", async (req, res) => {
    // Return all beds, sorted by room and number
    const beds = await Bed.find().sort({ roomNumber: 1, bedNumber: 1 });
    res.json({ success: true, data: beds });
});

// --- PATIENTS ---
app.get("/patients", async (req, res) => {
    const patients = await Patient.find();
    res.json({ success: true, data: patients });
});

app.post("/patients", async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { bedId, ...patientData } = req.body;

        // 1. Create Patient
        const newPatient = new Patient({ ...patientData, assignedBedId: bedId });
        const savedPatient = await newPatient.save({ session });

        // 2. Update Bed if assigned
        if (bedId) {
            await Bed.updateOne(
                { bedId: bedId },
                { isOccupied: true, currentPatientId: savedPatient._id }
            ).session(session);
        }

        await session.commitTransaction();
        res.json({ success: true, data: savedPatient });
    } catch (err) {
        await session.abortTransaction();
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    } finally {
        session.endSession();
    }
});

app.get("/patients/:id", async (req, res) => {
    const patient = await Patient.findById(req.params.id);
    if (!patient) return res.status(404).json({ success: false });

    // Get latest vital
    const vital = await Vital.findOne({ bedId: patient.assignedBedId }).sort({ timestamp: -1 });
    // Convert to object and add vitals
    const patientObj = patient.toObject();

    res.json({ success: true, data: { ...patientObj, vitals: vital || {} } });
});

// --- VITALS ---
app.get("/vitals/latest/:bedId", async (req, res) => {
    const vital = await Vital
        .findOne({ bedId: req.params.bedId })
        .sort({ timestamp: -1 });

    res.json(vital || {});
});

// --- DISCHARGE ---
app.post("/beds/discharge", async (req, res) => {
    const { bedId } = req.body;

    // Find bed to get patient ID if needed
    const bed = await Bed.findOne({ bedId });

    if (bed && bed.currentPatientId) {
        await Patient.findByIdAndUpdate(bed.currentPatientId, { status: "Discharged", assignedBedId: null });
    }

    await Bed.updateOne(
        { bedId },
        { isOccupied: false, currentPatientId: null }
    );

    res.json({ success: true, message: "Patient discharged" });
});

app.listen(process.env.PORT, () =>
    console.log(`🚀 Server running on port ${process.env.PORT}`)
);
