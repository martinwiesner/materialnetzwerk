import { getDB } from '../config/db.js';

function hasShare(userId, entityType, entityId, requireEdit = false) {
  const db = getDB();
  if (requireEdit) {
    return !!db.prepare(
      `SELECT 1 FROM user_shares WHERE entity_type=? AND entity_id=? AND shared_with_user_id=? AND access_level='edit'`
    ).get(entityType, entityId, userId);
  }
  return !!db.prepare(
    `SELECT 1 FROM user_shares WHERE entity_type=? AND entity_id=? AND shared_with_user_id=?`
  ).get(entityType, entityId, userId);
}

function isActorMember(userId, actorId) {
  const db = getDB();
  return !!db.prepare(`SELECT 1 FROM users WHERE id=? AND actor_id=?`).get(userId, actorId);
}

export function canViewMaterial(userId, material) {
  if (!material) return false;
  const v = material.visibility || 'public';
  if (v === 'public') return true;
  if (!userId) return false;
  if (material.created_by === userId) return true;
  if (v === 'private') return hasShare(userId, 'material', material.id);
  if (v === 'selectedUsers') return hasShare(userId, 'material', material.id);
  if (v === 'actor') {
    if (material.share_actor_id && isActorMember(userId, material.share_actor_id)) return true;
    return hasShare(userId, 'material', material.id);
  }
  return false;
}

export function canEditMaterial(userId, material) {
  if (!material || !userId) return false;
  if (material.created_by === userId) return true;
  if (hasShare(userId, 'material', material.id, true)) return true;
  if (
    material.visibility === 'actor' &&
    material.share_actor_id &&
    material.actor_members_can_edit &&
    isActorMember(userId, material.share_actor_id)
  ) return true;
  return false;
}

export function canViewProject(userId, project) {
  if (!project) return false;
  const v = project.visibility || (project.is_public ? 'public' : 'private');
  if (v === 'public') return true;
  if (!userId) return false;
  if (project.owner_id === userId) return true;
  if (v === 'private') return hasShare(userId, 'project', project.id);
  if (v === 'selectedUsers') return hasShare(userId, 'project', project.id);
  if (v === 'actor') {
    if (project.share_actor_id && isActorMember(userId, project.share_actor_id)) return true;
    return hasShare(userId, 'project', project.id);
  }
  return false;
}
