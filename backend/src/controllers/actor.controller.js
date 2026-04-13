import Actor from '../models/actor.model.js';
import { getDB } from '../config/db.js';
import { resolve } from 'path';
import { existsSync, unlinkSync } from 'fs';

const UPLOAD_DIR = resolve(process.env.UPLOAD_PATH || './uploads');

function webPathToFs(webPath) {
  if (!webPath) return null;
  const rel = webPath.replace(/^\/uploads\//, '');
  return resolve(UPLOAD_DIR, rel);
}

function isOwnerOrAdmin(user, actor) {
  return user?.is_admin === 1 || actor.owner_id === user?.id;
}

export const getActors = (req, res) => {
  try {
    const actors = Actor.findAll({
      search: req.query.search,
      type: req.query.type,
    });
    res.json(actors);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const getActor = (req, res) => {
  try {
    const actor = Actor.findById(req.params.id);
    if (!actor) return res.status(404).json({ message: 'Not found' });
    res.json(actor);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const createActor = (req, res) => {
  try {
    const actor = Actor.create({ ...req.body, owner_id: req.user.id });
    res.status(201).json(actor);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const updateActor = (req, res) => {
  try {
    const actor = Actor.findById(req.params.id);
    if (!actor) return res.status(404).json({ message: 'Not found' });
    if (!isOwnerOrAdmin(req.user, actor)) return res.status(403).json({ message: 'Forbidden' });
    const updated = Actor.update(req.params.id, req.body);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const deleteActor = (req, res) => {
  try {
    const actor = Actor.findById(req.params.id);
    if (!actor) return res.status(404).json({ message: 'Not found' });
    if (!isOwnerOrAdmin(req.user, actor)) return res.status(403).json({ message: 'Forbidden' });
    Actor.delete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const uploadActorImage = (req, res) => {
  try {
    const actor = Actor.findById(req.params.id);
    if (!actor) return res.status(404).json({ message: 'Not found' });
    if (!isOwnerOrAdmin(req.user, actor)) return res.status(403).json({ message: 'Forbidden' });
    if (!req.files?.length) return res.status(400).json({ message: 'No files' });
    const images = req.files.map((f, i) => Actor.addImage(actor.id, f, i));
    res.status(201).json(images);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const addActorLink = (req, res) => {
  try {
    const actor = Actor.findById(req.params.id);
    if (!actor) return res.status(404).json({ message: 'Not found' });
    if (!isOwnerOrAdmin(req.user, actor)) return res.status(403).json({ message: 'Forbidden' });
    const { entity_type, entity_id } = req.body;
    if (!entity_type || !entity_id) return res.status(400).json({ message: 'entity_type and entity_id required' });
    if (!['material', 'project'].includes(entity_type)) return res.status(400).json({ message: 'entity_type must be material or project' });
    const link = Actor.addLink(actor.id, entity_type, entity_id);
    res.status(201).json(link);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const removeActorLink = (req, res) => {
  try {
    const actor = Actor.findById(req.params.id);
    if (!actor) return res.status(404).json({ message: 'Not found' });
    if (!isOwnerOrAdmin(req.user, actor)) return res.status(403).json({ message: 'Forbidden' });
    Actor.removeLink(req.params.linkId);
    res.json({ message: 'Deleted' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const deleteActorImage = (req, res) => {
  try {
    const actor = Actor.findById(req.params.id);
    if (!actor) return res.status(404).json({ message: 'Not found' });
    if (!isOwnerOrAdmin(req.user, actor)) return res.status(403).json({ message: 'Forbidden' });
    const img = Actor.deleteImage(req.params.imageId);
    if (img?.file_path) {
      const fs = webPathToFs(img.file_path);
      if (fs && existsSync(fs)) unlinkSync(fs);
    }
    res.json({ message: 'Deleted' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};
