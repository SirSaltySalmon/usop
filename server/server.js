const express = require('express');
const cors = require('cors');
const characterRoutes = require('./routes/characters');
const tagRoutes = require('./routes/tags');
const userRoutes = require('./routes/user');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from public/
app.use(express.static('public'));

// API routes
app.use('/api', characterRoutes);
app.use('/api', tagRoutes);
app.use('/api', userRoutes);

app.listen(3000, () => {
    console.log('Server running on port 3000');
});