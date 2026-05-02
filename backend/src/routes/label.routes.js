import { Router } from 'express';
import Material from '../models/material.model.js';
import Project from '../models/project.model.js';
import { generateLabelsPdf } from '../utils/labelPdfGenerator.js';

const router = Router();

/**
 * GET /api/labels/:entityType/:id
 * Returns an A4 PDF with 10 adhesive labels (105 × 57 mm, 2 × 5 grid).
 * No auth required — labels are public documents.
 */
router.get('/:entityType/:id', async (req, res) => {
  const { entityType, id } = req.params;

  let entity;
  if (entityType === 'materials') {
    entity = Material.findById(id);
  } else if (entityType === 'projects') {
    entity = Project.findById(id);
  } else {
    return res.status(400).json({ message: `Unsupported entity type: ${entityType}` });
  }

  if (!entity) {
    return res.status(404).json({ message: 'Entity not found' });
  }
  if (!entity.material_id) {
    return res.status(422).json({
      message: 'No material_id assigned to this entry yet.',
      hint: 'Only entries created after the material-ID feature was deployed have an ID.',
    });
  }

  try {
    const pdfBuffer = await generateLabelsPdf(entity, entityType);
    const filename = `aufkleber-${entity.material_id}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Label PDF generation error:', err);
    res.status(500).json({ message: 'PDF generation failed', error: err.message });
  }
});

export default router;
