import FeatureRequest from '../models/featureRequest.model.js';
import { createFeatureRequestWorkPackage } from '../services/openproject.service.js';

// POST /api/feature-requests — anonymous or logged-in
export const createFeatureRequest = async (req, res) => {
  const { title, description, name, email } = req.body;

  if (!title?.trim() || !description?.trim()) {
    return res.status(400).json({ message: 'Titel und Beschreibung sind erforderlich.' });
  }
  if (title.length > 200 || description.length > 3000) {
    return res.status(400).json({ message: 'Titel oder Beschreibung ist zu lang.' });
  }

  const submitterName = req.user
    ? `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || req.user.email
    : (name?.trim() || 'Anonym');
  const submitterEmail = req.user ? req.user.email : (email?.trim() || null);

  const id = FeatureRequest.create({
    user_id: req.user?.id,
    name: submitterName,
    email: submitterEmail,
    title: title.trim(),
    description: description.trim(),
  });

  try {
    const opDescription = `${description.trim()}\n\n---\nEingereicht von: ${submitterName}${submitterEmail ? ` (${submitterEmail})` : ''}\nQuelle: RZZ Materialdatenbank – Feature-Request-Formular`;
    const wpId = await createFeatureRequestWorkPackage({ subject: title.trim(), description: opDescription });
    FeatureRequest.markSent(id, wpId);
  } catch (err) {
    // Never fail the user-facing request just because the OpenProject relay failed —
    // the submission is safely stored locally and can be resent/reviewed later.
    console.error('OpenProject relay failed:', err.message);
    FeatureRequest.markFailed(id, err.message);
  }

  res.status(201).json({ message: 'Danke für deine Idee! Wir haben sie erhalten.' });
};
