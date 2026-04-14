import express from 'express';
import protect from '../middleware/auth.middleware.js';
import {
  createRequest,
  getMyRequests,
  getIncomingRequests,
  getRequestsByInventory,
  updateRequestStatus,
  deleteRequest,
} from '../controllers/materialRequest.controller.js';

const router = express.Router();

router.post('/',                              protect, createRequest);
router.get('/my',                             protect, getMyRequests);
router.get('/incoming',                       protect, getIncomingRequests);
router.get('/inventory/:inventoryId',         protect, getRequestsByInventory);
router.patch('/:id/status',                   protect, updateRequestStatus);
router.delete('/:id',                         protect, deleteRequest);

export default router;
