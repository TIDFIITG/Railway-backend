import mongoose from "mongoose";

const trainSchema = new mongoose.Schema({
    coach_uid: {
        type: String,
        required: [true, 'Coach UID is required'],
        validate: {
            validator: function(uid) {
                return /^\d+$/.test(uid);
            },
            message: 'Coach UID must be a numeric string'
        }
    },
    date: {
        type: String,
    },
    time: {
        type: String,
    },
    latitude: {
        type: String,
    },
    longitude: {
        type: String,
    },
    chain_status: {
        type: String,
        default: "normal",
        enum: ["normal", "pulled"],
    },

    event_type: {
    type: String,
    enum: ["ACP", "FSDS"],
    required: true,
    },

    temperature: {
        type: String,
    },
    division: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Division",
    },
    error: {
        type: String,
        default: "000",
    },
    memory: {
        type: String,
        default: "Not available",
    },
    humidity: {
        type: String,
        default: "Not available",
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Add indexes for better query performance
trainSchema.index({ coach_uid: 1 });
trainSchema.index({ division: 1 });
trainSchema.index({ coach_uid: 1, division: 1 }); // Compound index

// Pre-save middleware to validate that the coach_uid exists in Division and set division reference
trainSchema.pre('save', async function(next) {
    if (this.coach_uid) {
        try {
            const Division = mongoose.model('Division');
            
            // Find the division that contains this coach_uid
            const division = await Division.findOne({
                'coach_uid.uid': this.coach_uid
            });
            
            if (!division) {
                const error = new Error(`Coach UID ${this.coach_uid} not found in any division. Please check again.`);
                error.name = 'ValidationError';
                return next(error);
            }
            
            // Set the division ObjectId
            this.division = division._id;
        } catch (err) {
            return next(err);
        }
    }
    next();
});

// Virtual to get coach name from Division
trainSchema.virtual('coach_name').get(function() {
    if (this.populated('division') && this.division && this.division.coach_uid) {
        const coach = this.division.coach_uid.find(c => c.uid === this.coach_uid);
        return coach ? coach.coach_name : null;
    }
    return null;
});

// Virtual to get train number from Division
trainSchema.virtual('train_Number').get(function() {
    if (this.populated('division') && this.division) {
        return this.division.train_Number;
    }
    return null;
});

// Virtual to get train name from Division
trainSchema.virtual('train_Name').get(function() {
    if (this.populated('division') && this.division) {
        return this.division.train_Name;
    }
    return null;
});

// Method to populate coach details and division information
trainSchema.methods.populateCoachDetails = function() {
    return this.populate({
        path: 'division',
        select: 'coach_uid division states cities train_Name train_Number'
    });
};

export default mongoose.model("Train", trainSchema);