const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /api/character/random?tags=tag1,tag2&exclude=tag3&excludeIds=1,2,3
router.get('/character/random', (req, res) => {
    const { tags, exclude, excludeIds } = req.query;

    let whereClauses = [];
    let params = [];
    let joinClauses = [];
    let groupBy = ' GROUP BY characters.id ';

    // Exclude already seen characters
    if (excludeIds) {
        const ids = excludeIds.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
        if (ids.length > 0) {
            whereClauses.push(`characters.id NOT IN (${ids.map(() => '?').join(',')})`);
            params.push(...ids);
        }
    }

    // Tag inclusion (character must have at least one of the selected tags)
    if (tags) {
        const tagList = tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
        if (tagList.length > 0) {
            joinClauses.push('JOIN character_tags ct_incl ON characters.id = ct_incl.character_id');
            joinClauses.push('JOIN tags t_incl ON ct_incl.tag_id = t_incl.id');
            whereClauses.push(`t_incl.name IN (${tagList.map(() => '?').join(',')})`);
            params.push(...tagList);
        }
    }

    // Tag exclusion (character must NOT have any of the excluded tags)
    if (exclude) {
        const excludeList = exclude.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
        if (excludeList.length > 0) {
            joinClauses.push('LEFT JOIN character_tags ct_excl ON characters.id = ct_excl.character_id');
            joinClauses.push('LEFT JOIN tags t_excl ON ct_excl.tag_id = t_excl.id AND t_excl.name IN (' + excludeList.map(() => '?').join(',') + ')');
            whereClauses.push('t_excl.id IS NULL');
            params.push(...excludeList);
        }
    }

    // Build SQL query
    let sql = 'SELECT characters.* FROM characters ';
    if (joinClauses.length > 0) {
        sql += joinClauses.join(' ') + ' ';
    }
    if (whereClauses.length > 0) {
        sql += 'WHERE ' + whereClauses.join(' AND ') + ' ';
    }
    sql += groupBy;
    sql += 'ORDER BY RANDOM() LIMIT 1';

    db.get(sql, params, (err, row) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database error' });
        }
        if (!row) {
            return res.status(404).json({ error: 'No character found' });
        }
        // Fetch tags for the found character
        db.all(
            `SELECT t.name FROM tags t
             JOIN character_tags ct ON t.id = ct.tag_id
             WHERE ct.character_id = ?`,
            [row.id],
            (err2, tagRows) => {
                if (err2) {
                    console.error(err2);
                    return res.status(500).json({ error: 'Database error' });
                }
                const tagNames = tagRows.map(tr => tr.name);
                res.json({ ...row, tags: tagNames });
            }
        );
    });
});

// POST /api/character/:id/vote
router.post('/character/:id/vote', (req, res) => {
    const characterId = parseInt(req.params.id);
    const { sessionId, voteType } = req.body; // voteType: true for yes, false for no

    if (!sessionId || typeof voteType !== 'boolean') {
        return res.status(400).json({ error: 'sessionId and voteType (boolean) required' });
    }

    // Get current vote stats for majority calculation
    db.get(
        `SELECT 
            SUM(CASE WHEN vote_type = 1 THEN 1 ELSE 0 END) AS yesVotes,
            SUM(CASE WHEN vote_type = 0 THEN 1 ELSE 0 END) AS noVotes
         FROM user_interactions
         WHERE character_id = ? AND vote_type IS NOT NULL`,
        [characterId],
        (err, stats) => {
            if (err) return res.status(500).json({ error: 'Database error' });

            const yesVotes = stats.yesVotes || 0;
            const noVotes = stats.noVotes || 0;
            const totalVotes = yesVotes + noVotes + 1; // +1 for this vote

            const newYesVotes = voteType ? yesVotes + 1 : yesVotes;
            const newNoVotes = voteType ? noVotes : noVotes + 1;
            
            // Insert interaction
            db.run(
                `INSERT INTO user_interactions
                    (character_id, session_id, action_type, vote_type)
                 VALUES (?, ?, 'vote', ?)`,
                [characterId, sessionId, voteType],
                function (err) {
                    if (err) return res.status(500).json({ error: 'Database error' });
                    res.json({
                        success: true,
                        characterId,
                        voteType,
                        totalVotes,
                        newYesVotes,
                        newNoVotes
                    });
                }
            );
        }
    );
});

// POST /api/character/:id/skip
router.post('/character/:id/skip', (req, res) => {
    const characterId = parseInt(req.params.id);
    const { sessionId } = req.body;

    if (!sessionId) {
        return res.status(400).json({ error: 'sessionId required' });
    }

    db.run(
        `INSERT INTO user_interactions
            (character_id, session_id, action_type, vote_type)
         VALUES (?, ?, 'skip', NULL)`,
        [characterId, sessionId],
        function (err) {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json({ success: true, characterId });
        }
    );
});

// GET /api/character/:id/results
// Useful for getting the results without altering the vote count, for example when the user skips a character
router.get('/character/:id/results', (req, res) => {
    const characterId = parseInt(req.params.id);

    db.get(
        `SELECT * FROM characters WHERE id = ?`,
        [characterId],
        (err, character) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            if (!character) return res.status(404).json({ error: 'Character not found' });

            db.get(
                `SELECT 
                    COUNT(*) AS totalVotes,
                    SUM(CASE WHEN vote_type = 1 THEN 1 ELSE 0 END) AS yesVotes,
                    SUM(CASE WHEN vote_type = 0 THEN 1 ELSE 0 END) AS noVotes
                 FROM user_interactions
                 WHERE character_id = ? AND vote_type IS NOT NULL`,
                [characterId],
                (err, stats) => {
                    if (err) return res.status(500).json({ error: 'Database error' });

                    res.json({
                        character,
                        voteStats: {
                            totalVotes: stats.totalVotes || 0,
                            yesVotes: stats.yesVotes || 0,
                            noVotes: stats.noVotes || 0
                        }
                    });
                }
            );
        }
    );
});

module.exports = router;