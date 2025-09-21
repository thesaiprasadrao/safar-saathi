
import express from 'express';
import { TripService } from '../services/tripService.js';

const router = express.Router();


router.get('/active/:driverId', async (req, res) => {
  try {
    const { driverId } = req.params;

    if (!driverId) {
      return res.status(400).json({
        success: false,
        error: 'Driver ID is required'
      });
    }

    const result = await TripService.getActiveTrip(driverId);

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Get active trip endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});


router.post('/start', async (req, res) => {
  try {
    console.log('[Trips] POST /api/trips/start payload:', req.body);
    const { driverId, busNumber, startingLatitude, startingLongitude } = req.body;

    if (!driverId || !busNumber) {
      return res.status(400).json({
        success: false,
        error: 'Driver ID and bus number are required'
      });
    }

    const result = await TripService.startTrip(
      driverId,
      busNumber,
      startingLatitude !== undefined ? parseFloat(startingLatitude) : undefined,
      startingLongitude !== undefined ? parseFloat(startingLongitude) : undefined
    );
    console.log('[Trips] startTrip result:', result);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.status(201).json(result);
  } catch (error) {
    console.error('Start trip endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});


router.post('/end', async (req, res) => {
  try {
    const { tripId, endingLatitude, endingLongitude } = req.body;

    if (!tripId) {
      return res.status(400).json({
        success: false,
        error: 'Trip ID is required'
      });
    }

    const result = await TripService.endTrip(
      tripId,
      endingLatitude !== undefined ? parseFloat(endingLatitude) : undefined,
      endingLongitude !== undefined ? parseFloat(endingLongitude) : undefined
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('End trip endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});


router.get('/:tripId', async (req, res) => {
  try {
    const { tripId } = req.params;

    if (!tripId) {
      return res.status(400).json({
        success: false,
        error: 'Trip ID is required'
      });
    }

    const result = await TripService.getTripById(tripId);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Get trip endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;
