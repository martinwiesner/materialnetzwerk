import MaterialRequest from '../models/materialRequest.model.js';
import Message from '../models/message.model.js';
import User from '../models/user.model.js';
import { getDB } from '../config/db.js';
import { sendPushToUser } from '../services/push.service.js';
import { sendNewMessageEmail } from '../services/email.service.js';

const isAdmin = (u) => u?.is_admin === 1 || u?.is_admin === true;

// POST /api/requests  — create a new request (logged-in user)
export const createRequest = (req, res) => {
  try {
    const { inventory_id, quantity, unit, message } = req.body;
    if (!inventory_id) return res.status(400).json({ message: 'inventory_id required' });

    // Prevent owner from requesting their own offer
    const db = getDB();
    const inv = db.prepare('SELECT user_id FROM inventory WHERE id = ?').get(inventory_id);
    if (!inv) return res.status(404).json({ message: 'Angebot nicht gefunden.' });
    if (inv.user_id === req.user.id) return res.status(400).json({ message: 'Du kannst nicht dein eigenes Angebot anfragen.' });

    const request = MaterialRequest.create({
      inventory_id,
      requester_id: req.user.id,
      quantity: quantity ? parseFloat(quantity) : null,
      unit,
      message,
    });

    // Send internal message + push + email to the offer owner
    try {
      const requester = User.findById(req.user.id);
      const requesterName = requester?.first_name
        ? `${requester.first_name} ${requester.last_name || ''}`.trim()
        : requester?.email?.split('@')[0] || 'Jemand';

      const materialName = request.material_name || 'Material';
      const qtyText = quantity ? ` (${quantity} ${unit || ''})`.trim() : '';
      const msgContent = `Neue Materialanfrage für „${materialName}"${qtyText}.\n\n${message ? `Nachricht: ${message}` : ''}`.trim();

      Message.create({
        sender_id: req.user.id,
        receiver_id: inv.user_id,
        inventory_id,
        subject: `Materialanfrage: ${materialName}`,
        content: msgContent,
      });

      const owner = User.findById(inv.user_id);
      const ownerName = owner?.first_name
        ? `${owner.first_name} ${owner.last_name || ''}`.trim()
        : owner?.email?.split('@')[0] || 'Nutzer';

      sendPushToUser(inv.user_id, {
        title: `Neue Anfrage von ${requesterName}`,
        body: `${materialName}${qtyText}`,
        url: '/messages',
      }).catch(() => {});

      sendNewMessageEmail({
        toEmail: owner?.email,
        toName: ownerName,
        senderName: requesterName,
        subject: `Materialanfrage: ${materialName}`,
        preview: msgContent.slice(0, 100),
        appUrl: process.env.APP_URL || 'http://localhost:3000',
      }).catch(() => {});
    } catch (notifyErr) {
      // Notification failure must never block the request itself
      console.error('Request notification error:', notifyErr.message);
    }

    res.status(201).json(request);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/requests/my  — requests made by current user
export const getMyRequests = (req, res) => {
  try {
    res.json(MaterialRequest.findByRequester(req.user.id));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/requests/incoming  — requests received for all my offers
export const getIncomingRequests = (req, res) => {
  try {
    res.json(MaterialRequest.findPendingForOwner(req.user.id));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/requests/inventory/:inventoryId  — requests for a specific offer (owner only)
export const getRequestsByInventory = (req, res) => {
  try {
    const db = getDB();
    const inv = db.prepare('SELECT user_id FROM inventory WHERE id = ?').get(req.params.inventoryId);
    if (!inv) return res.status(404).json({ message: 'Angebot nicht gefunden.' });
    if (inv.user_id !== req.user.id && !isAdmin(req.user)) return res.status(403).json({ message: 'Nicht autorisiert.' });
    res.json(MaterialRequest.findByInventory(req.params.inventoryId));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/requests/:id/status  — owner accepts/declines/reserves/completes
export const updateRequestStatus = (req, res) => {
  try {
    const { status, owner_note } = req.body;
    const request = MaterialRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Anfrage nicht gefunden.' });
    if (request.owner_id !== req.user.id && !isAdmin(req.user)) return res.status(403).json({ message: 'Nicht autorisiert.' });
    const updated = MaterialRequest.updateStatus(req.params.id, status, owner_note);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// DELETE /api/requests/:id  — requester cancels their own request
export const deleteRequest = (req, res) => {
  try {
    const request = MaterialRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Anfrage nicht gefunden.' });
    if (request.requester_id !== req.user.id && !isAdmin(req.user)) return res.status(403).json({ message: 'Nicht autorisiert.' });
    MaterialRequest.delete(req.params.id);
    res.json({ message: 'Anfrage gelöscht.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
