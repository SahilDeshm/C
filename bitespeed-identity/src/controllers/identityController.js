import prisma from "../utils/db.js";

export const handleIdentify = async (req, res) => {
  try {
 
    console.log('Request Body:', req.body);
    const { email, phoneNumber } = req.body;

    // Step 1: Validate input
    if (!email && !phoneNumber) {
      return res.status(400).json({ error: "Email or phoneNumber is required" });
    }

    // Step 2: Find all contacts with matching email or phoneNumber, and not deleted
    const contacts = await prisma.contact.findMany({
      where: {
        AND: [
          { deletedAt: null },
          {
            OR: [
              email ? { email } : undefined,
              phoneNumber ? { phoneNumber } : undefined,
            ].filter(Boolean),
          },
        ],
      },
    });

    // Step 3: If no contacts found, create a new primary contact
    if (contacts.length === 0) {
      const newContact = await prisma.contact.create({
        data: {
          email,
          phoneNumber,
          linkPrecedence: 'primary',
        },
      });

      return res.status(200).json({
        contact: {
          primaryContatctId: newContact.id,
          emails: email ? [email] : [],
          phoneNumbers: phoneNumber ? [phoneNumber] : [],
          secondaryContactIds: [],
        },
      });
    }

    // Step 4: If contacts found, identify the oldest primary contact
    const primaryContacts = contacts.filter(c => c.linkPrecedence === 'primary');

    // Sort primary contacts by creation date ascending (oldest first)
    primaryContacts.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    const primaryContact = primaryContacts[0];

    // Step 5: Fetch all contacts linked to the primary contact (including primary itself)
    const linkedContacts = await prisma.contact.findMany({
      where: {
        AND: [
          { deletedAt: null },
          {
            OR: [
              { id: primaryContact.id },
              { linkedId: primaryContact.id },
            ],
          },
        ],
      },
    });

    // Step 6 (your existing code): Collect unique emails, phoneNumbers, secondaryContactIds
    const emails = [];
    const phoneNumbers = [];
    const secondaryContactIds = [];

    linkedContacts.forEach(contact => {
      if (contact.email && !emails.includes(contact.email)) emails.push(contact.email);
      if (contact.phoneNumber && !phoneNumbers.includes(contact.phoneNumber)) phoneNumbers.push(contact.phoneNumber);
      if (contact.linkPrecedence === 'secondary') secondaryContactIds.push(contact.id);
    });

    // --- New Step: Check if input email or phoneNumber is new ---
    let shouldCreateSecondary = false;

    if (email && !emails.includes(email)) shouldCreateSecondary = true;
    if (phoneNumber && !phoneNumbers.includes(phoneNumber)) shouldCreateSecondary = true;

    if (shouldCreateSecondary) {
      // Create a new secondary contact linked to primary
      const newSecondary = await prisma.contact.create({
        data: {
          email: email || null,
          phoneNumber: phoneNumber || null,
          linkedId: primaryContact.id,
          linkPrecedence: 'secondary',
        },
      });

      // Add new secondary contact info to arrays
      if (newSecondary.email && !emails.includes(newSecondary.email)) emails.push(newSecondary.email);
      if (newSecondary.phoneNumber && !phoneNumbers.includes(newSecondary.phoneNumber)) phoneNumbers.push(newSecondary.phoneNumber);
      secondaryContactIds.push(newSecondary.id);
    }


    // Step 7: Return the consolidated contact info
    return res.status(200).json({
      contact: {
        primaryContatctId: primaryContact.id,
        emails,
        phoneNumbers,
        secondaryContactIds,
      },
    });

  } catch (error) {
    console.error('Error in handleIdentify:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// In controllers/identityController.js (or create a new controller file for contacts)

// Get contact by ID with linked contacts info
export const getContactById = async (req, res) => {
  try {
    const contactId = parseInt(req.params.id);
    if (isNaN(contactId)) {
      return res.status(400).json({ error: "Invalid contact ID" });
    }

    // Find primary contact or secondary with linked primary
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!contact || contact.deletedAt) {
      return res.status(404).json({ error: "Contact not found" });
    }

    // Determine primary contact (if secondary, get linked primary)
    const primaryContactId = contact.linkPrecedence === "primary" ? contact.id : contact.linkedId;

    // Get all linked contacts including primary
    const linkedContacts = await prisma.contact.findMany({
      where: {
        AND: [
          { deletedAt: null },
          {
            OR: [
              { id: primaryContactId },
              { linkedId: primaryContactId },
            ],
          },
        ],
      },
    });

    // Collect emails, phoneNumbers, secondary IDs
    const emails = [];
    const phoneNumbers = [];
    const secondaryContactIds = [];

    linkedContacts.forEach(c => {
      if (c.email && !emails.includes(c.email)) emails.push(c.email);
      if (c.phoneNumber && !phoneNumbers.includes(c.phoneNumber)) phoneNumbers.push(c.phoneNumber);
      if (c.linkPrecedence === "secondary") secondaryContactIds.push(c.id);
    });

    return res.status(200).json({
      contact: {
        primaryContactId: primaryContactId,
        emails,
        phoneNumbers,
        secondaryContactIds,
      },
    });

  } catch (error) {
    console.error("Error in getContactById:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};


export const updateContact = async (req, res) => {
  try {
    const contactId = parseInt(req.params.id);
    if (isNaN(contactId)) {
      return res.status(400).json({ error: "Invalid contact ID" });
    }

    const { email, phoneNumber } = req.body;

    if (!email && !phoneNumber) {
      return res.status(400).json({ error: "At least one of email or phoneNumber must be provided" });
    }

    // Check if contact exists and not deleted
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!contact || contact.deletedAt) {
      return res.status(404).json({ error: "Contact not found" });
    }

    // Update the contact
    const updatedContact = await prisma.contact.update({
      where: { id: contactId },
      data: {
        ...(email && { email }),
        ...(phoneNumber && { phoneNumber }),
      },
    });

    return res.status(200).json({ message: "Contact updated", contact: updatedContact });
  } catch (error) {
    console.error("Error in updateContact:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const softDeleteContact = async (req, res) => {
  try {
    const contactId = parseInt(req.params.id);
    if (isNaN(contactId)) {
      return res.status(400).json({ error: "Invalid contact ID" });
    }

    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!contact || contact.deletedAt) {
      return res.status(404).json({ error: "Contact not found or already deleted" });
    }

    const deletedContact = await prisma.contact.update({
      where: { id: contactId },
      data: { deletedAt: new Date() },
    });

    return res.status(200).json({ message: "Contact soft deleted", contact: deletedContact });
  } catch (error) {
    console.error("Error in softDeleteContact:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
