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
    },

    temperature: {
        type: String,
    },
    division: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Division",
    },
    // Snapshot of the coach/train identity at the moment this record was created.
    // Stored (not derived) so it stays accurate even after the coach is later
    // reassigned to a different train and the division's coach list changes.
    coach_name: {
        type: String,
        default: null,
    },
    train_Name: {
        type: String,
        default: null,
    },
    train_Number: {
        type: String,
        default: null,
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

// Pre-save middleware to validate that the coach_uid exists in Division, set the
// division reference, and snapshot the coach/train identity onto the record itself.
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

            // Freeze the coach/train identity as of right now. Once set, don't
            // overwrite it on future saves of the same document — this is a
            // point-in-time snapshot, not a live-derived value.
            if (this.isNew) {
                const coach = division.coach_uid.find(c => c.uid === this.coach_uid);
                this.coach_name = coach ? coach.coach_name : null;
                this.train_Name = division.train_Name;
                this.train_Number = division.train_Number;
            }
        } catch (err) {
            return next(err);
        }
    }
    next();
});

// Method to populate coach details and division information
trainSchema.methods.populateCoachDetails = function() {
    return this.populate({
        path: 'division',
        select: 'coach_uid division states cities train_Name train_Number'
    });
};

export default mongoose.model("Train", trainSchema);