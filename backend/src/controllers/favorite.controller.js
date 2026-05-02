import Favorite from '../models/favorite.model.js';
import Material from '../models/material.model.js';
import Project from '../models/project.model.js';

export const getFavorites = (req, res) => {
  try {
    const userId = req.user.id;
    const favs = Favorite.findByUser(userId);

    const enriched = favs
      .map((f) => {
        let entity = null;
        if (f.entity_type === 'material') entity = Material.findById(f.entity_id);
        else if (f.entity_type === 'project') entity = Project.findById(f.entity_id);
        if (!entity) return null;
        return { ...f, entity };
      })
      .filter(Boolean);

    res.json({ data: enriched });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const addFavorite = (req, res) => {
  try {
    const { entity_type, entity_id } = req.body;
    if (!entity_type || !entity_id)
      return res.status(400).json({ error: 'entity_type and entity_id required' });
    if (!['material', 'project'].includes(entity_type))
      return res.status(400).json({ error: 'entity_type must be material or project' });

    Favorite.add(req.user.id, entity_type, entity_id);
    const count = Favorite.countByEntity(entity_type, entity_id);
    res.json({ ok: true, count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const removeFavorite = (req, res) => {
  try {
    const { entity_type, entity_id } = req.params;
    Favorite.remove(req.user.id, entity_type, entity_id);
    const count = Favorite.countByEntity(entity_type, entity_id);
    res.json({ ok: true, count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getFavoriteStatus = (req, res) => {
  try {
    const { entity_type, entity_id } = req.params;
    const count = Favorite.countByEntity(entity_type, entity_id);
    const isFavorited = req.user
      ? Favorite.isFavorited(req.user.id, entity_type, entity_id)
      : false;
    res.json({ count, isFavorited });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
