-- Adds Health Connect (Android) as a recognized Observation source, alongside
-- the existing apple-health / arc / manual / curiosity values.
alter type observation_source add value 'health-connect';
