// src/routes/identity.js
import express from 'express';
import { getContactById, handleIdentify, softDeleteContact, updateContact,  } from '../controllers/identityController.js';
    
const router = express.Router();

router.post('/', handleIdentify);
router.get('/:id' , getContactById);
router.put('/:id', updateContact);          
router.delete('/:id', softDeleteContact);

export default router;
