import { Router } from 'express';
import protect from '../middleware/auth.middleware.js';
import { getDB } from '../config/db.js';

const router = Router();

function adminOnly(req, res, next) {
  if (!req.user?.is_admin) return res.status(403).json({ message: 'Admin-Zugriff erforderlich' });
  next();
}

// GET /api/admin/stats
router.get('/stats', protect, adminOnly, (req, res) => {
  try {
    const db = getDB();

    // total counts
    const totals = {
      materials: db.prepare('SELECT COUNT(*) as n FROM materials').get().n,
      projects:  db.prepare('SELECT COUNT(*) as n FROM projects').get().n,
      actors:    db.prepare('SELECT COUNT(*) as n FROM actors').get().n,
      users:     db.prepare('SELECT COUNT(*) as n FROM users').get().n,
      pendingRequests: db.prepare("SELECT COUNT(*) as n FROM material_requests WHERE status = 'pending'").get().n,
      bookmarks: db.prepare('SELECT COUNT(*) as n FROM user_favorites').get().n,
    };

    // materials by category
    const byCategory = db.prepare(`
      SELECT COALESCE(category, 'Ohne Kategorie') as category, COUNT(*) as count
      FROM materials
      GROUP BY category
      ORDER BY count DESC
      LIMIT 12
    `).all();

    // top bookmarked materials
    const topBookmarked = db.prepare(`
      SELECT m.id, m.name, m.category, COUNT(f.id) as bookmark_count
      FROM materials m
      JOIN user_favorites f ON f.entity_id = m.id AND f.entity_type = 'material'
      GROUP BY m.id
      ORDER BY bookmark_count DESC
      LIMIT 5
    `).all();

    // most active users (by content created)
    const activeUsers = db.prepare(`
      SELECT
        u.id,
        COALESCE(u.first_name || ' ' || u.last_name, u.email) as display_name,
        u.email,
        (SELECT COUNT(*) FROM materials WHERE created_by = u.id) as mat_count,
        (SELECT COUNT(*) FROM projects  WHERE owner_id  = u.id) as proj_count
      FROM users u
      ORDER BY (mat_count + proj_count) DESC
      LIMIT 8
    `).all();

    // materials created per month (last 6 months)
    const materialsByMonth = db.prepare(`
      SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count
      FROM materials
      GROUP BY month
      ORDER BY month DESC
      LIMIT 6
    `).all().reverse();

    // open requests with requester + material info
    const openRequests = db.prepare(`
      SELECT
        r.id, r.quantity, r.unit, r.message, r.created_at,
        COALESCE(u.first_name || ' ' || u.last_name, u.email) as requester_name,
        u.email as requester_email,
        m.name as material_name
      FROM material_requests r
      LEFT JOIN users u ON u.id = r.requester_id
      LEFT JOIN inventory inv ON inv.id = r.inventory_id
      LEFT JOIN materials m ON m.id = inv.material_id
      WHERE r.status = 'pending'
      ORDER BY r.created_at DESC
      LIMIT 10
    `).all();

    res.json({ totals, byCategory, topBookmarked, activeUsers, materialsByMonth, openRequests });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
