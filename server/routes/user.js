const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /api/user/:sessionId/interactions - Get user's interaction history
router.get('/user/:sessionId/interactions', (req, res) => {
    const { sessionId } = req.params;
    db.all(
        `SELECT * FROM user_interactions WHERE session_id = ? ORDER BY interacted_at DESC`,
        [sessionId],
        (err, rows) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json(rows);
        }
    );
});

module.exports = router;