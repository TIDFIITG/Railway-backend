import Division from "../models/Division.js";
import userModel from "../models/User.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import logActivity from '../utils/logger.js';

// Add division --admin
export const addDivision = async (req, res) => {
    try {
        // IMMEDIATE DEBUG - Log raw request before any processing
        console.log("=== RAW REQUEST DEBUG ===");
        console.log("req.body:", req.body);
        console.log("req.body type:", typeof req.body);
        console.log("req.body keys:", Object.keys(req.body));
        console.log("req.body.coach_uid:", req.body.coach_uid);
        console.log("req.body.coach_uid type:", typeof req.body.coach_uid);
        console.log("req.body.coach_uid exists:", 'coach_uid' in req.body);
        console.log("Headers:", req.headers);
        console.log("Content-Type:", req.headers['content-type']);
        console.log("=== END RAW REQUEST DEBUG ===");

        const authHeader = req.headers.authorization;

        if (!authHeader) {
            await logActivity("Add Division: Authorization header missing.", 'warning');
            return res.status(401).json({ message: "Authorization header is missing. Please log in again." });
        }

        const token = authHeader.split(" ")[1];

        if (!token) {
            await logActivity("Add Division: Authorization token missing.", 'warning');
            return res.status(401).json({ message: "Authorization token is missing. Please log in again." });
        }

        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decodedToken.id;

        const user = await userModel.findById(userId);
        if (!user || user.role !== "admin") {
            await logActivity(`Add Division: Unauthorized attempt by user ID ${userId}.`, 'warning', userId);
            return res.status(403).json({ message: "You are not authorized to add divisions" });
        }

        const { division, states, cities, train_Name, train_Number, coach_uid } = req.body;

        // DEBUG destructuring
        console.log("=== DESTRUCTURED VALUES ===");
        console.log("division:", division);
        console.log("states:", states);
        console.log("cities:", cities);
        console.log("train_Name:", train_Name);
        console.log("train_Number:", train_Number);
        console.log("coach_uid after destructuring:", coach_uid);
        console.log("coach_uid type after destructuring:", typeof coach_uid);
        console.log("coach_uid is undefined:", coach_uid === undefined);
        console.log("coach_uid is null:", coach_uid === null);
        console.log("=== END DESTRUCTURED VALUES ===");

        // Validate required fields first
        if (!division || !states || !cities || !train_Name || !train_Number) {
            await logActivity(`Add Division: Missing required fields by user ID ${userId}.`, 'warning', userId);
            return res.status(400).json({ 
                message: "All fields (division, states, cities, train_Name, train_Number) are required",
                received: {
                    division: !!division,
                    states: !!states,
                    cities: !!cities,
                    train_Name: !!train_Name,
                    train_Number: !!train_Number
                }
            });
        }

        // COACH UID IS NOW MANDATORY - CHECK IMMEDIATELY
        console.log("=== COACH UID CHECK ===");
        console.log("coach_uid exists?", coach_uid !== undefined);
        console.log("coach_uid value:", coach_uid);
        console.log("coach_uid is falsy?", !coach_uid);
        console.log("=== END COACH UID CHECK ===");

        if (coach_uid === undefined || coach_uid === null) {
            console.log("COACH UID IS UNDEFINED OR NULL!");
            await logActivity(`Add Division: Coach UID is undefined/null by user ID ${userId}.`, 'warning', userId);
            return res.status(400).json({ 
                message: "coach_uid field is missing from request. At least one coach must be provided.",
                received: { 
                    coach_uid,
                    allKeys: Object.keys(req.body),
                    bodyType: typeof req.body
                },
                expectedFormat: {
                    coach_uid: [
                        {"uid": "101", "coach_name": "Coach A"},
                        {"uid": "102", "coach_name": "Coach B"}
                    ]
                }
            });
        }

        // Check if division with the same train data already exists
        const existingDivision = await Division.findOne({
            train_Number: train_Number.trim()
        });

        if (existingDivision) {
            await logActivity(`Add Division: Train number '${train_Number}' already exists.`, 'info', userId);
            return res.status(400).json({ message: `Train number '${train_Number}' already exists` });
        }

        // Process coach_uid - handle both string and array cases
        let coachArray = coach_uid;
        
        console.log("=== COACH PROCESSING ===");
        console.log("Initial coach_uid:", coachArray);
        console.log("Type:", typeof coachArray);
        
        // If it's a string, try to parse it as JSON
        if (typeof coach_uid === 'string') {
            console.log("Coach UID received as string, attempting to parse...");
            try {
                coachArray = JSON.parse(coach_uid);
                console.log("Successfully parsed coach_uid:", coachArray);
            } catch (parseError) {
                console.log("Failed to parse coach_uid as JSON:", parseError.message);
                await logActivity(`Add Division: Invalid coach_uid JSON format by user ID ${userId}.`, 'warning', userId);
                return res.status(400).json({ 
                    message: "coach_uid must be a valid JSON array or array object",
                    received: coach_uid,
                    parseError: parseError.message
                });
            }
        }

        // Ensure it's an array
        if (!Array.isArray(coachArray)) {
            console.log("Coach data is not an array:", typeof coachArray);
            await logActivity(`Add Division: coach_uid must be an array by user ID ${userId}.`, 'warning', userId);
            return res.status(400).json({ 
                message: "coach_uid must be an array of coach objects",
                received: coachArray,
                receivedType: typeof coachArray
            });
        }

        // Ensure at least one coach
        if (coachArray.length === 0) {
            console.log("Empty coach array provided");
            await logActivity(`Add Division: Empty coach array provided by user ID ${userId}.`, 'warning', userId);
            return res.status(400).json({ 
                message: "At least one coach must be provided",
                received: coachArray,
                length: coachArray.length
            });
        }

        console.log(`Processing ${coachArray.length} coaches...`);

        // Validate and process each coach
        const validatedCoachUid = [];
        const seenUids = new Set();

        for (let i = 0; i < coachArray.length; i++) {
            const coach = coachArray[i];
            console.log(`Processing coach ${i + 1}:`, coach);

            // Validate coach object structure
            if (!coach || typeof coach !== 'object') {
                console.log(`Invalid coach object at index ${i}`);
                await logActivity(`Add Division: Invalid coach object at index ${i} by user ID ${userId}.`, 'warning', userId);
                return res.status(400).json({ 
                    message: `Coach at position ${i + 1} must be an object with 'uid' and 'coach_name' properties`,
                    received: coach,
                    receivedType: typeof coach
                });
            }

            // Validate UID
            if (!coach.uid) {
                console.log(`Missing UID at index ${i}`);
                await logActivity(`Add Division: Missing UID at index ${i} by user ID ${userId}.`, 'warning', userId);
                return res.status(400).json({ 
                    message: `Coach at position ${i + 1} is missing 'uid' field`,
                    coach: coach
                });
            }

            // Ensure UID is string and validate format
            const uidStr = String(coach.uid).trim();
            if (!uidStr || !/^\d+$/.test(uidStr)) {
                console.log(`Invalid UID format at index ${i}:`, uidStr);
                await logActivity(`Add Division: Invalid UID format '${uidStr}' at index ${i} by user ID ${userId}.`, 'warning', userId);
                return res.status(400).json({ 
                    message: `Coach at position ${i + 1} has invalid UID '${uidStr}'. UID must be a numeric string (e.g., "101", "102")`,
                    received: coach.uid,
                    processed: uidStr
                });
            }

            // Check for duplicate UIDs
            if (seenUids.has(uidStr)) {
                console.log(`Duplicate UID found at index ${i}:`, uidStr);
                await logActivity(`Add Division: Duplicate UID '${uidStr}' at index ${i} by user ID ${userId}.`, 'warning', userId);
                return res.status(400).json({ 
                    message: `Duplicate UID '${uidStr}' found at position ${i + 1}. Each coach must have a unique UID`
                });
            }
            seenUids.add(uidStr);

            // Validate coach name
            if (!coach.coach_name) {
                console.log(`Missing coach_name at index ${i}`);
                await logActivity(`Add Division: Missing coach_name at index ${i} by user ID ${userId}.`, 'warning', userId);
                return res.status(400).json({ 
                    message: `Coach at position ${i + 1} is missing 'coach_name' field`,
                    coach: coach
                });
            }

            const coachNameStr = String(coach.coach_name).trim();
            if (!coachNameStr) {
                console.log(`Empty coach_name at index ${i}`);
                await logActivity(`Add Division: Empty coach_name at index ${i} by user ID ${userId}.`, 'warning', userId);
                return res.status(400).json({ 
                    message: `Coach at position ${i + 1} has empty 'coach_name'`,
                    received: coach.coach_name
                });
            }

            // Add validated coach
            const validatedCoach = {
                uid: uidStr,
                coach_name: coachNameStr
            };
            
            console.log(`Validated coach ${i + 1}:`, validatedCoach);
            validatedCoachUid.push(validatedCoach);
        }

        console.log("All coaches validated successfully:", validatedCoachUid);
        console.log("=== END COACH PROCESSING ===");

        // Create division data
        const divisionData = {
            division: division.trim(),
            states: states.trim(),
            cities: cities.trim(),
            train_Name: train_Name.trim(),
            train_Number: train_Number.trim(),
            coach_uid: validatedCoachUid
        };

        console.log("=== DIVISION DATA ===");
        console.log("Final division data to save:", JSON.stringify(divisionData, null, 2));
        console.log("Division data coach_uid length:", divisionData.coach_uid.length);
        console.log("=== END DIVISION DATA ===");

        // Create mongoose document
        console.log("=== MONGOOSE DOCUMENT CREATION ===");
        const newDivision = new Division(divisionData);
        
        console.log("Division object before save:");
        console.log("- _id:", newDivision._id);
        console.log("- division:", newDivision.division);
        console.log("- train_Name:", newDivision.train_Name);
        console.log("- train_Number:", newDivision.train_Number);
        console.log("- coach_uid length:", newDivision.coach_uid ? newDivision.coach_uid.length : 'undefined');
        console.log("- coach_uid content:", JSON.stringify(newDivision.coach_uid, null, 2));

        // Check if coach_uid is being set properly
        if (!newDivision.coach_uid || newDivision.coach_uid.length === 0) {
            console.log("ERROR: coach_uid is empty on mongoose document!");
            console.log("Original validatedCoachUid:", validatedCoachUid);
            console.log("Document coach_uid:", newDivision.coach_uid);
            
            // Try to manually assign
            newDivision.coach_uid = validatedCoachUid;
            console.log("After manual assignment:", newDivision.coach_uid);
        }

        // Manual validation check
        console.log("=== VALIDATION CHECK ===");
        const validationResult = newDivision.validateSync();
        if (validationResult) {
            console.log("Validation failed:", validationResult.errors);
            await logActivity(`Add Division: Validation failed. ${validationResult.message}`, 'error', userId);
            return res.status(400).json({
                message: "Data validation failed",
                details: Object.keys(validationResult.errors).map(key => ({
                    field: key,
                    message: validationResult.errors[key].message,
                    value: validationResult.errors[key].value
                }))
            });
        }
        console.log("Validation passed successfully");
        console.log("=== END VALIDATION CHECK ===");

        console.log("=== SAVING TO DATABASE ===");
        console.log("About to save division with coach_uid:", JSON.stringify(newDivision.coach_uid, null, 2));
        
        const savedDivision = await newDivision.save();
        
        console.log("Division saved successfully!");
        console.log("Saved division ID:", savedDivision._id);
        console.log("Saved division coach_uid:", JSON.stringify(savedDivision.coach_uid, null, 2));
        console.log("Saved division coach count:", savedDivision.coach_uid ? savedDivision.coach_uid.length : 'undefined');

        // Double-check by fetching from database
        console.log("=== DATABASE VERIFICATION ===");
        const fetchedDivision = await Division.findById(savedDivision._id);
        console.log("Fetched from DB - ID:", fetchedDivision._id);
        console.log("Fetched from DB - coach count:", fetchedDivision.coach_uid ? fetchedDivision.coach_uid.length : 'undefined');
        console.log("Fetched from DB - coaches:", JSON.stringify(fetchedDivision.coach_uid, null, 2));
        console.log("=== END DATABASE VERIFICATION ===");

        console.log("=== END ALL DEBUG ===");

        await logActivity(`Admin added new train: '${train_Name}' (#${train_Number}) with ${validatedCoachUid.length} coaches.`, 'success', userId);
        
        res.status(201).json({ 
            message: "Division added successfully", 
            division: savedDivision,
            coachCount: savedDivision.coach_uid ? savedDivision.coach_uid.length : 0,
            debug: {
                receivedCoaches: validatedCoachUid.length,
                savedCoaches: savedDivision.coach_uid ? savedDivision.coach_uid.length : 0
            }
        });
        
    } catch (error) {
        console.error("=== ADD DIVISION ERROR ===");
        console.error("Error name:", error.name);
        console.error("Error message:", error.message);
        console.error("Full error:", error);
        console.error("Stack:", error.stack);
        
        if (error.name === "JsonWebTokenError") {
            await logActivity(`Add Division: Invalid token. Error: ${error.message}`, 'error');
            return res.status(401).json({ message: "Invalid token. Please log in again." });
        }
        
        if (error.name === "ValidationError") {
            console.error("Mongoose validation errors:", error.errors);
            const errorDetails = Object.keys(error.errors).map(key => ({
                field: key,
                message: error.errors[key].message,
                value: error.errors[key].value
            }));
            
            await logActivity(`Add Division: Validation error. ${error.message}`, 'error', userId);
            return res.status(400).json({ 
                message: "Data validation failed", 
                details: errorDetails
            });
        }
        
        if (error.code === 11000) {
            await logActivity(`Add Division: Duplicate key error. ${error.message}`, 'error', userId);
            return res.status(400).json({ 
                message: "Train number already exists", 
                error: "Duplicate train number not allowed" 
            });
        }
        
        await logActivity(`Add Division: Unexpected error. ${error.message}`, 'error', userId);
        res.status(500).json({ 
            message: "An error occurred while adding the division", 
            error: error.message 
        });
    }
};

// Test endpoint to debug incoming data
export const testCoachData = async (req, res) => {
    console.log("=== TEST COACH DATA ENDPOINT ===");
    console.log("Method:", req.method);
    console.log("Content-Type:", req.headers['content-type']);
    console.log("Raw Body:", req.body);
    console.log("Body Keys:", Object.keys(req.body));
    console.log("Coach UID:", req.body.coach_uid);
    console.log("Coach UID Type:", typeof req.body.coach_uid);
    console.log("Coach UID exists:", 'coach_uid' in req.body);
    console.log("Is Array:", Array.isArray(req.body.coach_uid));
    
    if (req.body.coach_uid) {
        console.log("Coach UID JSON:", JSON.stringify(req.body.coach_uid, null, 2));
        
        if (Array.isArray(req.body.coach_uid)) {
            console.log("Coach count:", req.body.coach_uid.length);
            req.body.coach_uid.forEach((coach, index) => {
                console.log(`Coach ${index}:`, coach);
                console.log(`- Type:`, typeof coach);
                console.log(`- UID:`, coach?.uid, typeof coach?.uid);
                console.log(`- Name:`, coach?.coach_name, typeof coach?.coach_name);
            });
        }
    }
    
    res.json({
        success: true,
        received: {
            body: req.body,
            bodyKeys: Object.keys(req.body),
            coachUid: req.body.coach_uid,
            coachUidType: typeof req.body.coach_uid,
            coachUidExists: 'coach_uid' in req.body,
            isArray: Array.isArray(req.body.coach_uid),
            coachCount: Array.isArray(req.body.coach_uid) ? req.body.coach_uid.length : 0
        },
        headers: req.headers
    });
};

// Modify/Update division --admin
export const modifyDivision = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            await logActivity("Modify Division: Authorization header missing.", 'warning');
            return res.status(401).json({ message: "Authorization header is missing. Please log in again." });
        }

        const token = authHeader.split(" ")[1];

        if (!token) {
            await logActivity("Modify Division: Authorization token missing.", 'warning');
            return res.status(401).json({ message: "Authorization token is missing. Please log in again." });
        }

        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decodedToken.id;

        const user = await userModel.findById(userId);
        if (!user || user.role !== "admin") {
            await logActivity(`Modify Division: Unauthorized attempt by user ID ${userId}.`, 'warning', userId);
            return res.status(403).json({ message: "You are not authorized to modify divisions" });
        }

        const { id } = req.params;
        const { division, states, cities, train_Name, train_Number, coach_uid } = req.body;

        // DEBUG: Log received data
        console.log("=== MODIFY DIVISION DEBUG ===");
        console.log("Division ID:", id);
        console.log("Received body:", JSON.stringify(req.body, null, 2));

        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            await logActivity(`Modify Division: Invalid ID format '${id}' provided by user ID ${userId}.`, 'warning', userId);
            return res.status(400).json({ message: "Invalid Division ID provided. Must be a valid MongoDB ObjectId." });
        }

        const existingDivision = await Division.findById(id);
        if (!existingDivision) {
            await logActivity(`Modify Division: Division with ID '${id}' not found by user ID ${userId}.`, 'warning', userId);
            return res.status(404).json({ message: "Division not found." });
        }

        // Validate coach_uid if provided
        let validatedCoachUid = undefined;
        
        if (coach_uid !== undefined) {
            if (!Array.isArray(coach_uid)) {
                await logActivity(`Modify Division: coach_uid is not an array by user ID ${userId}.`, 'warning', userId);
                return res.status(400).json({ message: "coach_uid must be an array" });
            }

            validatedCoachUid = [];

            // Validate each coach object
            for (let i = 0; i < coach_uid.length; i++) {
                const coach = coach_uid[i];

                if (!coach || typeof coach !== 'object') {
                    await logActivity(`Modify Division: Invalid coach object at index ${i} by user ID ${userId}.`, 'warning', userId);
                    return res.status(400).json({ 
                        message: `Coach at index ${i} must be an object with uid and coach_name` 
                    });
                }

                if (!coach.uid || typeof coach.uid !== 'string') {
                    await logActivity(`Modify Division: Missing or invalid uid at index ${i} by user ID ${userId}.`, 'warning', userId);
                    return res.status(400).json({ 
                        message: `Coach at index ${i} must have a valid uid (string)` 
                    });
                }

                if (!coach.coach_name || typeof coach.coach_name !== 'string') {
                    await logActivity(`Modify Division: Missing or invalid coach_name at index ${i} by user ID ${userId}.`, 'warning', userId);
                    return res.status(400).json({ 
                        message: `Coach at index ${i} must have a valid coach_name (string)` 
                    });
                }

                // Validate UID format
                if (!/^\d+$/.test(coach.uid)) {
                    await logActivity(`Modify Division: Invalid UID format '${coach.uid}' at index ${i} by user ID ${userId}.`, 'warning', userId);
                    return res.status(400).json({ 
                        message: `Invalid UID format '${coach.uid}' at index ${i}. UID must be numeric string.` 
                    });
                }

                validatedCoachUid.push({
                    uid: coach.uid.trim(),
                    coach_name: coach.coach_name.trim()
                });
            }

            // Check for duplicate UIDs
            const uids = validatedCoachUid.map(coach => coach.uid);
            const uniqueUids = new Set(uids);
            if (uids.length !== uniqueUids.size) {
                await logActivity(`Modify Division: Duplicate coach UIDs found by user ID ${userId}.`, 'warning', userId);
                return res.status(400).json({ message: "Duplicate coach UIDs are not allowed" });
            }
        }

        // Update fields
        const updateData = {};
        if (division !== undefined) updateData.division = division.trim();
        if (states !== undefined) updateData.states = states.trim();
        if (cities !== undefined) updateData.cities = cities.trim();
        if (train_Name !== undefined) updateData.train_Name = train_Name.trim();
        if (train_Number !== undefined) updateData.train_Number = train_Number.trim();
        if (validatedCoachUid !== undefined) updateData.coach_uid = validatedCoachUid;

        console.log("Update data:", JSON.stringify(updateData, null, 2));

        const updatedDivision = await Division.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        console.log("Updated division:", JSON.stringify(updatedDivision, null, 2));
        console.log("=== END MODIFY DIVISION DEBUG ===");

        await logActivity(`Admin modified train: '${updatedDivision.train_Name}' (#${updatedDivision.train_Number}) with ID '${id}'.`, 'success', userId);
        res.status(200).json({ 
            message: "Division updated successfully", 
            division: updatedDivision 
        });

    } catch (error) {
        console.error("=== MODIFY DIVISION ERROR ===");
        console.error("Error name:", error.name);
        console.error("Error message:", error.message);
        console.error("Full error:", error);
        
        if (error.name === "JsonWebTokenError") {
            await logActivity(`Modify Division: Invalid token. Error: ${error.message}`, 'error');
            return res.status(401).json({ message: "Invalid token. Please log in again." });
        }
        
        if (error.name === 'CastError' && error.path === '_id') {
            await logActivity(`Modify Division: CastError for ID '${req.params.id}'. Error: ${error.message}`, 'error', userId);
            return res.status(400).json({ message: "Invalid Division ID format." });
        }
        
        if (error.name === "ValidationError") {
            console.error("Validation errors:", error.errors);
            await logActivity(`Modify Division: Validation error. Error: ${error.message}`, 'error', userId);
            return res.status(400).json({ 
                message: "Validation error", 
                details: Object.keys(error.errors).map(key => ({
                    field: key,
                    message: error.errors[key].message
                }))
            });
        }
        
        await logActivity(`Modify Division: An error occurred while updating train ID '${req.params.id}'. Error: ${error.message}`, 'error', userId);
        console.error("Error modifying division:", error);
        res.status(500).json({ message: "An error occurred while updating the division.", error: error.message });
    }
};

// Delete division (which is a train) --admin
export const deleteDivision = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            await logActivity("Delete Division: Authorization header missing.", 'warning');
            return res.status(401).json({ message: "Authorization header is missing. Please log in again." });
        }

        const token = authHeader.split(" ")[1];

        if (!token) {
            await logActivity("Delete Division: Authorization token missing.", 'warning');
            return res.status(401).json({ message: "Authorization token is missing. Please log in again." });
        }

        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decodedToken.id;

        const user = await userModel.findById(userId);
        if (!user || user.role !== "admin") {
            await logActivity(`Delete Division: Unauthorized attempt by user ID ${userId}.`, 'warning', userId);
            return res.status(403).json({ message: "You are not authorized to delete divisions" });
        }

        const { id } = req.params;

        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            await logActivity(`Delete Division: Invalid ID format '${id}' provided by user ID ${userId}.`, 'warning', userId);
            return res.status(400).json({ message: "Invalid Division ID provided. Must be a valid MongoDB ObjectId." });
        }

        const division = await Division.findById(id);
        if (!division) {
            await logActivity(`Delete Division: Attempted to delete non-existent train with ID '${id}' by user ID ${userId}.`, 'warning', userId);
            return res.status(404).json({ message: "Division (Train) not found." });
        }

        await Division.findByIdAndDelete(id);
        await logActivity(`Admin deleted train: '${division.train_Name}' (#${division.train_Number}) with ID '${id}'.`, 'success', userId);
        res.status(200).json({ message: "Division (Train) deleted successfully." });
    } catch (error) {
        if (error.name === "JsonWebTokenError") {
            await logActivity(`Delete Division: Invalid token. Error: ${error.message}`, 'error');
            return res.status(401).json({ message: "Invalid token. Please log in again." });
        }
        if (error.name === 'CastError' && error.path === '_id') {
            await logActivity(`Delete Division: CastError for ID '${req.params.id}'. Error: ${error.message}`, 'error', req.userId);
            return res.status(400).json({ message: "Invalid Division ID format." });
        }
        await logActivity(`Delete Division: An error occurred while deleting train ID '${req.params.id}'. Error: ${error.message}`, 'error', req.userId);
        console.error("Error deleting division:", error);
        res.status(500).json({ message: "An error occurred while deleting the division (train).", error: error.message });
    }
};

// Get all divisions
export const getAllDivisions = async (req, res) => {
    try {
        const divisions = await Division.find().sort({ createdAt: -1 });
        await logActivity("Fetched all divisions (trains).", 'info');
        res.status(200).json({
            status: "Success",
            data: divisions,
        });
    } catch (error) {
        await logActivity(`Get All Divisions: An error occurred. Error: ${error.message}`, 'error');
        console.error("Error fetching all divisions:", error);
        res.status(500).json({ message: error.message });
    }
};

// Get recently added divisions
export const getRecentlyAddedDivisions = async (req, res) => {
    try {
        const divisions = await Division.find().sort({ createdAt: -1 }).limit(4);
        await logActivity("Fetched recently added divisions (trains).", 'info');
        res.status(200).json({
            status: "Success",
            data: divisions,
        });
    } catch (error) {
        await logActivity(`Get Recently Added Divisions: An error occurred. Error: ${error.message}`, 'error');
        console.error("Error fetching recently added divisions:", error);
        res.status(500).json({ message: error.message });
    }
};

// Get Division by ID
export const getDivisionById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            await logActivity(`Get Division by ID: Invalid ID format '${id}' provided.`, 'warning');
            return res.status(400).json({ message: "Invalid Division ID" });
        }

        const division = await Division.findById(id);

        if (!division) {
            await logActivity(`Get Division by ID: Division with ID '${id}' not found.`, 'info');
            return res.status(404).json({ message: "Division not found" });
        }
        await logActivity(`Fetched division '${division.train_Name}' (#${division.train_Number}) by ID '${id}'.`, 'info');
        return res.json({
            status: "Success",
            data: division,
        });
    } catch (error) {
        if (error.name === 'CastError' && error.path === '_id') {
            await logActivity(`Get Division by ID: CastError for ID '${req.params.id}'. Error: ${error.message}`, 'error');
            return res.status(400).json({ message: "Invalid Division ID format." });
        }
        await logActivity(`Get Division by ID: An error occurred for ID '${req.params.id}'. Error: ${error.message}`, 'error');
        console.error("Error fetching division by ID:", error);
        return res.status(500).json({ message: error.message });
    }
};

// Add coach to existing division --admin
export const addCoachToDivision = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            await logActivity("Add Coach: Authorization header missing.", 'warning');
            return res.status(401).json({ message: "Authorization header is missing. Please log in again." });
        }

        const token = authHeader.split(" ")[1];

        if (!token) {
            await logActivity("Add Coach: Authorization token missing.", 'warning');
            return res.status(401).json({ message: "Authorization token is missing. Please log in again." });
        }

        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decodedToken.id;

        const user = await userModel.findById(userId);
        if (!user || user.role !== "admin") {
            await logActivity(`Add Coach: Unauthorized attempt by user ID ${userId}.`, 'warning', userId);
            return res.status(403).json({ message: "You are not authorized to add coaches" });
        }

        const { id } = req.params;
        const { uid, coach_name } = req.body;

        console.log("=== ADD COACH DEBUG ===");
        console.log("Division ID:", id);
        console.log("Coach data:", { uid, coach_name });

        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            await logActivity(`Add Coach: Invalid division ID format '${id}' provided by user ID ${userId}.`, 'warning', userId);
            return res.status(400).json({ message: "Invalid Division ID provided." });
        }

        if (!uid || !coach_name) {
            await logActivity(`Add Coach: Missing required fields by user ID ${userId}.`, 'warning', userId);
            return res.status(400).json({ message: "Both uid and coach_name are required" });
        }

        // Validate UID format
        if (!/^\d+$/.test(uid)) {
            await logActivity(`Add Coach: Invalid UID format '${uid}' by user ID ${userId}.`, 'warning', userId);
            return res.status(400).json({ message: "UID must be a numeric string" });
        }

        const division = await Division.findById(id);
        if (!division) {
            await logActivity(`Add Coach: Division with ID '${id}' not found by user ID ${userId}.`, 'warning', userId);
            return res.status(404).json({ message: "Division not found." });
        }

        // Check if UID already exists
        const existingCoach = division.coach_uid.find(coach => coach.uid === uid);
        if (existingCoach) {
            await logActivity(`Add Coach: Attempted to add existing coach UID '${uid}' by user ID ${userId}.`, 'warning', userId);
            return res.status(400).json({ message: "Coach with this UID already exists" });
        }

        division.coach_uid.push({ 
            uid: uid.trim(), 
            coach_name: coach_name.trim() 
        });
        
        const savedDivision = await division.save();
        
        console.log("Division after adding coach:", JSON.stringify(savedDivision, null, 2));
        console.log("=== END ADD COACH DEBUG ===");

        await logActivity(`Admin added coach '${coach_name}' (UID: ${uid}) to train '${division.train_Name}'.`, 'success', userId);
        res.status(200).json({ 
            message: "Coach added successfully", 
            division: savedDivision 
        });

    } catch (error) {
        console.error("=== ADD COACH ERROR ===");
        console.error("Error:", error);
        
        if (error.name === "JsonWebTokenError") {
            await logActivity(`Add Coach: Invalid token. Error: ${error.message}`, 'error');
            return res.status(401).json({ message: "Invalid token. Please log in again." });
        }
        
        if (error.name === "ValidationError") {
            console.error("Validation errors:", error.errors);
            await logActivity(`Add Coach: Validation error. Error: ${error.message}`, 'error', userId);
            return res.status(400).json({ 
                message: "Validation error", 
                details: Object.keys(error.errors).map(key => ({
                    field: key,
                    message: error.errors[key].message
                }))
            });
        }
        
        await logActivity(`Add Coach: An error occurred. Error: ${error.message}`, 'error', userId);
        console.error("Error adding coach:", error);
        res.status(500).json({ message: "An error occurred while adding the coach", error: error.message });
    }
};

// Remove coach from division --admin
export const removeCoachFromDivision = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            await logActivity("Remove Coach: Authorization header missing.", 'warning');
            return res.status(401).json({ message: "Authorization header is missing. Please log in again." });
        }

        const token = authHeader.split(" ")[1];

        if (!token) {
            await logActivity("Remove Coach: Authorization token missing.", 'warning');
            return res.status(401).json({ message: "Authorization token is missing. Please log in again." });
        }

        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decodedToken.id;

        const user = await userModel.findById(userId);
        if (!user || user.role !== "admin") {
            await logActivity(`Remove Coach: Unauthorized attempt by user ID ${userId}.`, 'warning', userId);
            return res.status(403).json({ message: "You are not authorized to remove coaches" });
        }

        const { id, uid } = req.params;

        console.log("=== REMOVE COACH DEBUG ===");
        console.log("Division ID:", id);
        console.log("Coach UID to remove:", uid);

        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            await logActivity(`Remove Coach: Invalid division ID format '${id}' provided by user ID ${userId}.`, 'warning', userId);
            return res.status(400).json({ message: "Invalid Division ID provided." });
        }

        if (!uid) {
            await logActivity(`Remove Coach: Missing coach UID by user ID ${userId}.`, 'warning', userId);
            return res.status(400).json({ message: "Coach UID is required" });
        }

        const division = await Division.findById(id);
        if (!division) {
            await logActivity(`Remove Coach: Division with ID '${id}' not found by user ID ${userId}.`, 'warning', userId);
            return res.status(404).json({ message: "Division not found." });
        }

        const coachIndex = division.coach_uid.findIndex(coach => coach.uid === uid);
        if (coachIndex === -1) {
            await logActivity(`Remove Coach: Coach with UID '${uid}' not found in division '${id}' by user ID ${userId}.`, 'warning', userId);
            return res.status(404).json({ message: "Coach not found." });
        }

        const removedCoach = division.coach_uid[coachIndex];
        division.coach_uid.splice(coachIndex, 1);
        const savedDivision = await division.save();

        console.log("Division after removing coach:", JSON.stringify(savedDivision, null, 2));
        console.log("=== END REMOVE COACH DEBUG ===");

        await logActivity(`Admin removed coach '${removedCoach.coach_name}' (UID: ${uid}) from train '${division.train_Name}'.`, 'success', userId);
        res.status(200).json({ 
            message: "Coach removed successfully", 
            division: savedDivision 
        });

    } catch (error) {
        console.error("=== REMOVE COACH ERROR ===");
        console.error("Error:", error);
        
        if (error.name === "JsonWebTokenError") {
            await logActivity(`Remove Coach: Invalid token. Error: ${error.message}`, 'error');
            return res.status(401).json({ message: "Invalid token. Please log in again." });
        }
        
        await logActivity(`Remove Coach: An error occurred. Error: ${error.message}`, 'error', userId);
        console.error("Error removing coach:", error);
        res.status(500).json({ message: "An error occurred while removing the coach", error: error.message });
    }
};


// Transfer Coach from one train to another
export const transferCoach = async (req, res) => {
    try {

        const { coach_uid, fromDivisionId, toDivisionId } = req.body;

        // Validate request
        if (!coach_uid || !fromDivisionId || !toDivisionId) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields."
            });
        }

        // Find both trains
        const fromDivision = await Division.findById(fromDivisionId);
        const toDivision = await Division.findById(toDivisionId);

        if (!fromDivision || !toDivision) {
            return res.status(404).json({
                success: false,
                message: "Train not found."
            });
        }

        // Find the coach in the current train
        const coach = fromDivision.coach_uid.find(
            (c) => c.uid === coach_uid
        );

        if (!coach) {
            return res.status(404).json({
                success: false,
                message: "Coach not found."
            });
        }

        // Prevent duplicate coach UID in destination train
        const alreadyExists = toDivision.coach_uid.some(
            (c) => c.uid === coach_uid
        );

        if (alreadyExists) {
            return res.status(400).json({
                success: false,
                message: "Coach already exists in the selected train."
            });
        }

        // Remove from current train
        fromDivision.coach_uid = fromDivision.coach_uid.filter(
            (c) => c.uid !== coach_uid
        );

        // Add to destination train
        toDivision.coach_uid.push(coach);

        // Save both documents
        await fromDivision.save();
        await toDivision.save();

        res.status(200).json({
            success: true,
            message: "Coach transferred successfully."
        });

    } catch (error) {
        console.error("Transfer Coach Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to transfer coach."
        });
    }
};