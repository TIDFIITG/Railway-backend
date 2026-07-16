import jwt from "jsonwebtoken";

const UserAuth = async (req, res, next) => {
    try {
        // Extract the token from the Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({ success: false, message: "Authorization header is missing. Please log in again." });
        }

        // Token should be in the format "Bearer <token>"
        const token = authHeader.split(" ")[1];

        if (!token) {
            return res.status(401).json({ success: false, message: "Authorization token is missing. Please log in again." });
        }

        // Verify and decode the token
        const tokenDecoder = jwt.verify(token, process.env.JWT_SECRET);

        // Attach the user ID to the request object
        if (tokenDecoder.id) {
            req.userId = tokenDecoder.id;
            req.role = tokenDecoder.role; // 👈 Add this line
        } else {
            return res.status(401).json({
                success: false,
                message: "Invalid token. Please log in again."
            });
        }

        // Proceed to the next middleware or route
        next();
    } catch (error) {
        // Handle any errors during token verification
        return res.status(401).json({ success: false, message: "Authentication failed: " + error.message });
    }
};

export default UserAuth;
