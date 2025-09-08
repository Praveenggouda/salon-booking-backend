const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const Razorpay = require("razorpay");
const multer = require('multer');
const dayjs = require('dayjs');
const cors = require('cors');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config();

const razorpay = new Razorpay({
    key_id: "rzp_test_R29Ppjp3FeAogH",
    key_secret: "rSlp9PhhdL2FPVYcGOtge0Rm"
});
const app = express();
const PORT = 3000;

// Setup Gmail transporter
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  }
});



// OTP Map
const otpMap = new Map();

// Middleware setup
app.use(cors());
app.use(express.json()); //  Handle JSON
app.use(express.urlencoded({ extended: true })); // Handle form data

// Serve public files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Allow only your frontend domain
app.use(cors({
  origin: 'https://salon-booking-frontends.onrender.com',
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// Create upload folder if not exists
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Setup multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext);
  }
});
const upload = multer({ storage });

// MySQL connection
const db = require("./db.js");



//  1. Register route - send OTP
app.post('/register', async (req, res) => {
  const { name, email, password, phone, gender } = req.body;

  try {
    // Check if already registered
    const [rows] = await db.query("SELECT * FROM users WHERE email = ? OR phone = ?", [email, phone]);
    if (rows.length > 0) {
      return res.json({ success: false, message: "Email or phone already registered" });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000);
    otpMap.set(email, { otp, data: { name, email, password, phone, gender }, expires: Date.now() + 5 * 60000 }); // 5 minutes

    // Send email
    await transporter.sendMail({
      from: 'praveengouda31@gmail.com',
      to: email,
      subject: 'Your OTP for Salon Registration',
      html: `<h3>Your OTP is: <span>${otp}</span></h3>`
    });

    res.json({ success: true, message: "OTP sent to email" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

//  2. Verify OTP and complete registration
app.post('/verify-otp', async (req, res) => {
  const { name, email, password, phone, gender, otp } = req.body;
  const stored = otpMap.get(email);

  if (!stored || Date.now() > stored.expires) {
    return res.json({ success: false, message: "OTP expired or not found" });
  }

  if (parseInt(otp) !== stored.otp) {
    return res.json({ success: false, message: "Incorrect OTP" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query(
      "INSERT INTO users (name, email, password, phone, gender) VALUES (?, ?, ?, ?, ?)",
      [name, email, hashedPassword, phone, gender]
    );

    otpMap.delete(email);
    res.json({ success: true, message: "Registration successful" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Database error" });
  }
});


// Login Route (with bcrypt)
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (isMatch) {
      res.json({
        success: true,
        message: 'Login successful',
        name: user.name,
        email: user.email
      });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

// middleware/verifyAdmin.js
module.exports = (req, res, next) => {
  if (req.session && req.session.admin) {
    next();
  } else {
    res.status(401).json({ message: "Unauthorized. Please login." });
  }
};

// Register endpoint (for admin or salon_owner)
// --- Admin registration ---



app.post('/admin/send-otp', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'All fields required' });
  }

  try {
    const [existing] = await db.query('SELECT * FROM admins WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Admin already exists' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000);
    otpMap.set(email, {
      otp,
      data: { name, email, password },
      expires: Date.now() + 5 * 60 * 1000
    });

    await transporter.sendMail({
      from: 'EasySalon Admin <praveengouda31@gmail.com>',
      to: email,
      subject: 'Your Admin OTP - EasySalon',
      text: `Your OTP is: ${otp}. It expires in 5 minutes.`,
    });

    res.json({ success: true, message: 'OTP sent to email' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

//  Route: Verify OTP and register admin
app.post('/admin/verify-otp', async (req, res) => {
  const { name, email, password, otp } = req.body;
  const record = otpMap.get(email);

  if (!record) {
    return res.status(400).json({ success: false, message: 'No OTP found for this email' });
  }

  if (Date.now() > record.expires) {
    otpMap.delete(email);
    return res.status(400).json({ success: false, message: 'OTP expired' });
  }

  if (String(record.otp) !== otp) {
    return res.status(400).json({ success: false, message: 'Incorrect OTP' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query('INSERT INTO admins (name, email, password) VALUES (?, ?, ?)', [
      name,
      email,
      hashedPassword
    ]);
    otpMap.delete(email);
    res.json({ success: true, message: 'Admin registered successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

app.post('/admin/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const [rows] = await db.query('SELECT * FROM admins WHERE email = ?', [email]);

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Admin not found' });
    }

    const admin = rows[0];

    const isMatch = await bcrypt.compare(password, admin.password);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid password' });
    }

    res.json({
      success: true,
      message: 'Login successful',
      name: admin.name,
      email: admin.email
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


/// Add Salon Route (Promise-based, file upload supported)
app.post('/admin/add-salon', upload.single('photo'), async (req, res) => {
  const { salonName, location, priceRange, rating, description, ownerEmail } = req.body;

  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Photo is required' });
  }

  const photo = req.file.filename;

  try {
    // Step 1: Check if this owner has already added a salon
    const [existing] = await db.query('SELECT * FROM salons WHERE owner_email = ?', [ownerEmail]);

    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'You have already added a salon.' });
    }

    // Step 2: Insert new salon
    const insertQuery = `
      INSERT INTO salons (salonName, location, priceRange, rating, description, photo, owner_email)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await db.query(insertQuery, [
      salonName,
      location,
      priceRange,
      rating,
      description,
      photo,
      ownerEmail
    ]);

    const salonId = result.insertId;

    //  Step 3: Update admins table to link this salonId
    await db.query(`UPDATE admins SET salon_id = ? WHERE email = ?`, [salonId, ownerEmail]);

    // Step 4: Respond with success
    res.json({ success: true, message: 'Salon added and linked to admin', salonId });

  } catch (error) {
    console.error('Error adding salon:', error);
    res.status(500).json({ success: false, message: 'Server/database error' });
  }
});
app.post('/api/update-salon', async (req, res) => {
  try {
    const { email, salonName, fullLocation, services, staffs } = req.body;

    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const [adminRows] = await db.execute('SELECT salon_id FROM admins WHERE email = ?', [email]);

    if (adminRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Salon not found for this email' });
    }

    const salonId = adminRows[0].salon_id;

await db.execute(
  'UPDATE salon_details SET salonName = ?, fullLocation = ?, services = ?, staffs = ? WHERE id = ?',
  [salonName, fullLocation, services, staffs, salonId]
);

    res.json({ success: true, message: 'Salon updated successfully' });

  } catch (err) {
    console.error('❌ Update salon error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});


// Your GET route to fetch a single salon
app.get('/salon/:id', async (req, res) => {
  const id = req.params.id;
  try {
    // Assuming you have a promise-based db.query or db.execute function:
const [rows] = await db.promise().execute('SELECT * FROM salons WHERE id = ?', [id]);


    if (rows.length === 0) {
      return res.status(404).send('Salon not found');
    }

    const salon = rows[0];

    // Pass the correct properties to your template:
    res.render('salonDetails', {
      salonName: salon.salonName,
      location: salon.location,       // <-- use location, not city
      priceRange: salon.priceRange,
      rating: salon.rating,
      description: salon.description,
      photoURL: salon.photoURL || salon.photo  // whichever you want to use
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});
// Admin Stats Endpoint
// Admin Stats Endpoint - corrected version
app.get('/api/admin-stats', async (req, res) => {
  let connection;
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: 'Admin email is required' });
    }

    connection = await db.getConnection();

    //  Get total users who booked this admin's salon
    const [users] = await connection.query(`
      SELECT COUNT(DISTINCT bookings.user_email) as totalUsers
      FROM bookings
      JOIN salons ON bookings.salon_id = salons.id
      WHERE salons.owner_email = ?
    `, [email]);
    const totalUsers = users[0].totalUsers;

    //  Get total bookings for this admin
    const [bookings] = await connection.query(
      'SELECT COUNT(*) as totalBookings FROM bookings WHERE salon_owner_email = ?',
      [email]
    );
    const totalBookings = bookings[0].totalBookings;

    res.json({
      totalUsers,
      totalBookings
    });

  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Server error' });
  } finally {
    if (connection) connection.release();
  }
});


// Admin Salon Details Endpoint
app.get('/api/admin-salon', async (req, res) => {
  let connection;
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: 'Admin email is required' });
    }

   connection = await db.getConnection();

    // Get salon details
    const [salons] = await connection.query(
      'SELECT * FROM salons WHERE owner_email = ?',
      [email]
    );

    if (salons.length === 0) {
      return res.status(404).json({ error: 'Salon not found for this admin' });
    }

    const salon = salons[0];
    
    res.json({
      salon: {
        salonName: salon.salonName,
        location: salon.location,
        priceRange: salon.priceRange,
        rating: salon.rating,
        description: salon.description,
        photo: salon.photo
      }
    });

  } catch (error) {
    console.error('Error fetching salon details:', error);
    res.status(500).json({ error: 'Server error' });
  } finally {
    if (connection) connection.release();
  }
});
app.post('/api/update-salon', async (req, res) => {
  const { email, salonName, location, priceRange, rating, description, services, staffs } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  let updateFields = [];
  let values = [];

  if (salonName) {
    updateFields.push('salonName = ?');
    values.push(salonName);
  }

  if (location) {
    updateFields.push('location = ?');
    values.push(location);
  }

  if (priceRange) {
    updateFields.push('priceRange = ?');
    values.push(priceRange);
  }

  if (rating !== undefined && rating !== null && rating !== '') {
    updateFields.push('rating = ?');
    values.push(rating);
  }

  if (description) {
    updateFields.push('description = ?');
    values.push(description);
  }

  if (services) {
    updateFields.push('main_service = ?');
    values.push(services);
  }

  if (staffs) {
    updateFields.push('staffs = ?');
    values.push(staffs);
  }

  if (updateFields.length === 0) {
    return res.status(400).json({ success: false, message: 'No fields provided to update' });
  }

  const sql = `UPDATE salons SET ${updateFields.join(', ')} WHERE owner_email = ?`;
  values.push(email);

  try {
    await pool.query(sql, values);
    res.json({ success: true });
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ success: false, message: 'Update failed' });
  }
});
// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});
app.post('/api/add-salon-details', upload.array('photos'), async (req, res) => {
  try {
    const {
      salonId,
      salonName,
      fullLocation,
      services,
      staffs,
      phone,
      email,
      hours,
      instagram,
      pincode,
      city,
      state,
      description = null,  // Added with default value
      amenities = null     // Added with default value
    } = req.body;

    // Handle photo uploads
    const photos = req.files?.length 
      ? req.files.map(file => file.filename).join(',') 
      : null;

    const sql = `
      INSERT INTO salon_details 
      (salonId, salonName, fullLocation, photos, services, staffs, phone, email, 
       hours, instagram, pincode, city, state, description, amenities) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await db.query(sql, [
      salonId,
      salonName,
      fullLocation,
      photos,
      services,
      staffs,
      phone,
      email,
      hours,
      instagram,
      pincode,
      city,
      state,
      description,
      amenities
    ]);

    res.json({ success: true, message: 'Salon details saved successfully' });

  } catch (err) {
    console.error('Error saving salon details:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to save salon details',
      error: err.message // Include error message in response for debugging
    });
  }
});


// server.js - Add this route
app.get('/api/salon-details/:id', async (req, res) => {
  try {
    const salonId = req.params.id;
    
    // Add debug logging
    console.log(`Fetching salon details for ID: ${salonId}`);
    
    // Verify the ID is a number
    if (isNaN(salonId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid salon ID format' 
      });
    }

    const [rows] = await db.query(
      'SELECT * FROM salon_details WHERE salonId = ?', 
      [parseInt(salonId)]  // Ensure numeric value
    );

    console.log('Database results:', rows);  // Debug log

    if (rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Salon not found' 
      });
    }

    res.json({ 
      success: true, 
      data: rows[0] 
    });

  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Database query failed',
      error: err.message  // Include actual error message
    });
  }
});


// Get salons by city
app.get('/salons/city/:location', async (req, res) => {
  const city = req.params.location;
  console.log('Fetching salons for city:', city);

  const sql = 'SELECT * FROM salons WHERE location = ?';
  try {
    const [results] = await db.query(sql, [city]);
    console.log('Salons found:', results.length);
    res.json(results);
  } catch (err) {
    console.error('DB fetch error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Get salon by ID
app.get('/salon/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const [result] = await db.query('SELECT * FROM salons WHERE id = ?', [id]);
    if (result.length === 0) return res.status(404).json({ message: 'Salon not found' });
    res.json(result[0]);
  } catch (err) {
    console.error('Error fetching salon by ID:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});
// Get owner's salon by email

app.get("/admin-bookings", async (req, res) => {
  const email = req.query.email;
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    const [bookings] = await db.query(`
      SELECT 
        b.id, 
        b.user_email, 
        b.user_name, 
        b.salon_name, 
        b.staff, 
        b.booking_date, 
        b.slot_time, 
        b.status, 
        b.created_at 
      FROM bookings b
      JOIN salons s ON b.salon_id = s.id
      WHERE s.owner_email = ?
      ORDER BY b.created_at DESC
    `, [email]);

    res.json(bookings);
  } catch (err) {
    console.error("Error fetching owner bookings:", err);
    res.status(500).json({ error: "Database error" });
  }
});



//  Convert HH:MM to minutes
function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

//  Convert minutes to HH:MM
function formatTime(minutes) {
  const hrs = Math.floor(minutes / 60).toString().padStart(2, '0');
  const mins = (minutes % 60).toString().padStart(2, '0');
  return `${hrs}:${mins}`;
}

//  Generate time slots (20-min gap)
function generateAllSlots(start = "09:00", end = "18:00", gap = 20) {
  const slots = [];
  let current = timeToMinutes(start);
  const endMin = timeToMinutes(end);
  while (current + gap <= endMin) {
    slots.push(formatTime(current));
    current += gap;
  }
  return slots;
}

app.post('/api/available-slots', async (req, res) => {
  const { salon_id, booking_date, staff } = req.body;

  if (!salon_id || !booking_date || !staff) {
    return res.status(400).json({ error: 'Missing data' });
  }

  try {
    const [rows] = await db.query(
      'SELECT slot_time FROM bookings WHERE salon_id = ? AND booking_date = ? AND staff = ?',
      [salon_id, booking_date, staff]
    );

    const bookedSlots = rows.map(r => timeToMinutes(r.slot_time));

    const allSlots = generateAllSlots(); // 20-min interval
    const availableSlots = [];

    for (let slot of allSlots) {
      const slotMin = timeToMinutes(slot);
      const isConflicting = bookedSlots.some(booked =>
        Math.abs(booked - slotMin) < 40
      );

      if (!isConflicting) {
        availableSlots.push(slot);
      }
    }

    res.json({ availableSlots });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

//  Create Razorpay Order
app.post('/api/create-order', async (req, res) => {
  const { amount } = req.body;

  try {
    const options = {
      amount: amount * 100, // ₹10 = 1000 paise
      currency: "INR",
      receipt: `receipt_order_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    res.status(200).json({ order });
  } catch (err) {
    console.error("Razorpay order creation failed:", err);
    res.status(500).json({ error: "Failed to create Razorpay order" });
  }
});
app.post('/api/verify-payment', (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  const keySecret = "rSlp9PhhdL2FPVYcGOtge0Rm"; // your test secret key
  const body = razorpay_order_id + "|" + razorpay_payment_id;

  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(body.toString())
    .digest('hex');

  if (expectedSignature === razorpay_signature) {
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});
app.post('/api/book-salon', async (req, res) => {
  const {
    salon_id,
    salon_name,
    staff,
    booking_date,
    slot_time,
    user_email,
    user_name,
    payment_id
  } = req.body;

  try {
    // 1. Get salon owner email
    const [ownerRows] = await db.query('SELECT email FROM admins WHERE salon_id = ?', [salon_id]);

    if (ownerRows.length === 0) {
      return res.status(404).json({ error: 'Salon owner not found' });
    }

    const salon_owner_email = ownerRows[0].email;

    // 2. Insert booking into DB
    const insertQuery = `
      INSERT INTO bookings (
        salon_id, salon_name, staff, booking_date, slot_time,
        user_email, user_name, payment_id, salon_owner_email
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await db.query(insertQuery, [
      salon_id,
      salon_name,
      staff,
      booking_date,
      slot_time,
      user_email,
      user_name,
      payment_id,
      salon_owner_email
    ]);

    // 3. Email to Salon Owner
    const ownerMail = {
      from: process.env.GMAIL_USER,
      to: salon_owner_email,
      subject: `🔔 New Booking - ${salon_name}`,
      html: `
        <h2>New Booking Received</h2>
        <p><strong>User Name:</strong> ${user_name}</p>
        <p><strong>User Email:</strong> ${user_email}</p>
        <p><strong>Salon:</strong> ${salon_name}</p>
        <p><strong>Staff:</strong> ${staff}</p>
        <p><strong>Date:</strong> ${booking_date}</p>
        <p><strong>Time Slot:</strong> ${slot_time}</p>
        <p><strong>Payment ID:</strong> ${payment_id}</p>
      `
    };
    await transporter.sendMail(ownerMail);
    console.log(" Email sent to salon owner:", salon_owner_email);

    // 4. Email to User (Customer)
    const userMail = {
      from: process.env.GMAIL_USER,
      to: user_email,
      subject: ` Your Booking is Confirmed - ${salon_name}`,
      html: `
        <h2>Hi ${user_name},</h2>
        <p>Your booking at <strong>${salon_name}</strong> is confirmed!</p>
        <p><strong>Staff:</strong> ${staff}</p>
        <p><strong>Date:</strong> ${booking_date}</p>
        <p><strong>Time:</strong> ${slot_time}</p>
        <p><strong>Payment ID:</strong> ${payment_id}</p>
        <br/>
        <p>Thanks for using EasySalonBooking 💇‍♂️💇‍♀️</p>
      `
    };
    await transporter.sendMail(userMail);
    console.log(" Confirmation email sent to user:", user_email);

    // 5. Send response
    res.status(200).json({ message: 'Booking successful and emails sent to both user and salon owner!' });

  } catch (error) {
    console.error(' Booking Error:', error);
    res.status(500).json({ error: 'Server error during booking' });
  }
});





//user bookings
app.get('/api/my-bookings', async (req, res) => {
  const userEmail = req.query.userEmail;

  if (!userEmail) {
    return res.status(400).json({ error: 'Missing userEmail' });
  }

  try {
    const [results] = await db.execute(
      `SELECT * FROM bookings WHERE user_email = ? ORDER BY booking_date DESC, booking_time DESC`,
      [userEmail]
    );

    const formattedResults = results.map(row => ({
      ...row,
      booking_date: dayjs(row.booking_date).format('YYYY-MM-DD')
    }));

    res.json({ bookings: formattedResults });

  } catch (err) {
    console.error('Fetch bookings error:', err);
    res.status(500).json({ error: 'Database error fetching bookings', details: err.message });
  }
});
app.get('/api/stats', (req, res) => {
  const queries = {
    users: 'SELECT COUNT(*) AS totalUsers FROM users',
    salons: 'SELECT COUNT(*) AS totalSalons FROM salons',
    bookings: 'SELECT COUNT(*) AS totalBookings FROM bookings'
  };

  Promise.all([
    db.query(queries.users).then(([rows]) => rows[0].totalUsers),
    db.query(queries.salons).then(([rows]) => rows[0].totalSalons),
    db.query(queries.bookings).then(([rows]) => rows[0].totalBookings),
  ])
    .then(([totalUsers, totalSalons, totalBookings]) => {
      res.json({ totalUsers, totalSalons, totalBookings });
    })
    .catch(err => {
      console.error('Error fetching stats:', err);
      res.status(500).json({ error: 'Database error' });
    });
});



// --------------------------------------------
//  Start Server
// --------------------------------------------
app.listen(PORT, () => {
  console.log(` Server running on http://localhost:${PORT}`);
});

