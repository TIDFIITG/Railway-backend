import mongoose from "mongoose";

const divisionSchema = new mongoose.Schema(
    {
        division: {
            type: String,
            required: true,
            trim: true
        },
        states: {
            type: String,
            trim: true
        },
        cities: {
            type: String,
            trim: true
        },
        train_Name: {
            type: String,
            required: true,
            trim: true
        },
        train_Number: {
            type: String,
            required: true,
            trim: true
        },
        coach_uid: {
            type: [{
                uid: {
                    type: String,
                    required: [true, 'Coach UID is required'],
                    validate: {
                        validator: function(uid) {
                            return /^\d+$/.test(uid);
                        },
                        message: 'UID must be a numeric string'
                    }
                },
                coach_name: {
                    type: String,
                    required: [true, 'Coach name is required'],
                    trim: true
                }
            }],
            required: [true, 'At least one coach is required'],
            validate: {
                validator: function(coaches) {
                    return coaches && coaches.length > 0;
                },
                message: 'At least one coach must be provided'
            }
        }
    },
    { 
        timestamps: true,
        // This helps with debugging
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

// Add index for better query performance
divisionSchema.index({ train_Number: 1 }, { unique: true });
divisionSchema.index({ 'coach_uid.uid': 1 });

// Pre-save middleware to ensure coach_uid uniqueness within the document
divisionSchema.pre('save', function(next) {
    if (this.coach_uid && this.coach_uid.length > 0) {
        const uids = this.coach_uid.map(coach => coach.uid);
        const uniqueUids = [...new Set(uids)];
        
        if (uids.length !== uniqueUids.length) {
            const error = new Error('Duplicate coach UIDs are not allowed within the same train');
            error.name = 'ValidationError';
            return next(error);
        }
    }
    next();
});

export default mongoose.model("Division", divisionSchema);