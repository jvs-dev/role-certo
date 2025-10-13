import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, doc, getDoc, getDocs, query, 
         where, orderBy, limit, updateDoc, arrayUnion, arrayRemove, 
         startAfter, DocumentSnapshot, Timestamp, deleteDoc } from '@angular/fire/firestore';
import { Observable, from, map, BehaviorSubject } from 'rxjs';
import { Event, EventFormData } from '../models/interfaces';

@Injectable({
  providedIn: 'root'
})
export class EventService {
  private eventsCollection;
  private lastDocSubject = new BehaviorSubject<DocumentSnapshot | null>(null);

  constructor(private firestore: Firestore) {
    this.eventsCollection = collection(this.firestore, 'events');
  }

  async createEvent(eventData: EventFormData, creatorId: string, creatorName: string, creatorPhotoURL: string): Promise<string> {
    // For recurring events, we need to handle the date properly
    let eventDateTimestamp;
    
    if (eventData.isRecurring) {
      // For recurring events, we still store the original date but mark it as recurring
      // The frontend logic will determine how to display it
      eventDateTimestamp = Timestamp.fromDate(new Date(eventData.eventDate + 'T' + eventData.eventTime));
    } else {
      // For regular events, use the normal date logic
      eventDateTimestamp = Timestamp.fromDate(new Date(eventData.eventDate + 'T' + eventData.eventTime));
    }
    
    // Prepare the event document, excluding undefined values
    const eventDoc: any = {
      eventName: eventData.eventName,
      location: {
        address: eventData.location.address,
        city: eventData.location.city,
        state: eventData.location.state
      },
      eventDate: eventDateTimestamp,
      eventTime: eventData.eventTime,
      minAge: eventData.minAge,
      details: eventData.details,
      whatsappLink: eventData.whatsappLink,
      maxParticipants: eventData.maxParticipants,
      participants: [],
      privacy: eventData.privacy,
      creatorId,
      creatorName,
      creatorPhotoURL,
      createdAt: Timestamp.now()
    };
    
    // Add coordinates if they exist
    if (eventData.coordinates) {
      eventDoc.coordinates = eventData.coordinates;
    }
    
    // Add imageUrl if it exists
    if (eventData.imageUrl) {
      eventDoc.imageUrl = eventData.imageUrl;
    }
    
    // Add recurring event fields only if they exist
    if (eventData.isRecurring) {
      eventDoc.isRecurring = eventData.isRecurring;
      
      if (eventData.recurrenceType) {
        eventDoc.recurrenceType = eventData.recurrenceType;
      }
      
      if (eventData.weeklyDays && eventData.weeklyDays.length > 0) {
        eventDoc.weeklyDays = eventData.weeklyDays;
      }
      
      if (eventData.monthlyDays) {
        eventDoc.monthlyDays = eventData.monthlyDays;
      }
    }
    
    const docRef = await addDoc(this.eventsCollection, eventDoc);
    
    // Update event document with its own ID
    await updateDoc(docRef, { eventId: docRef.id });
    
    // Update user's createdEvents array
    const userRef = doc(this.firestore, 'users', creatorId);
    await updateDoc(userRef, {
      createdEvents: arrayUnion(docRef.id)
    });

    return docRef.id;
  }

  async getEvent(eventId: string): Promise<Event | null> {
    try {
      const eventDoc = await getDoc(doc(this.firestore, 'events', eventId));
      if (eventDoc.exists()) {
        const data = eventDoc.data();
        return {
          ...data,
          eventId: eventDoc.id,
          eventDate: data['eventDate'].toDate()
        } as Event;
      }
      return null;
    } catch (error) {
      console.error('Error getting event:', error);
      return null;
    }
  }

  async getEvents(userCity?: string, limitCount: number = 10): Promise<Event[]> {
    try {
      let q;
      
      if (userCity) {
        // First try to get events from user's city
        // Include both upcoming events and recurring events
        q = query(
          this.eventsCollection,
          where('location.city', '==', userCity),
          orderBy('eventDate', 'asc'),
          limit(limitCount)
        );
      } else {
        // If no city provided, get all events (upcoming and recurring)
        q = query(
          this.eventsCollection,
          orderBy('eventDate', 'asc'),
          limit(limitCount)
        );
      }

      const querySnapshot = await getDocs(q);
      const events: Event[] = [];
      const now = new Date();

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const eventDate = data['eventDate'].toDate();
        
        // Include the event if:
        // 1. It's an upcoming event (normal event)
        // 2. It's a recurring event (regardless of date)
        const isUpcomingEvent = eventDate >= now;
        const isRecurringEvent = data['isRecurring'] === true;
        
        if (isUpcomingEvent || isRecurringEvent) {
          events.push({
            ...data,
            eventId: doc.id,
            eventDate: eventDate
          } as Event);
        }
      });

      // Store the last document for pagination
      if (querySnapshot.docs.length > 0) {
        this.lastDocSubject.next(querySnapshot.docs[querySnapshot.docs.length - 1]);
      }

      return events;
    } catch (error) {
      console.error('Error getting events:', error);
      return [];
    }
  }

  async getMoreEvents(userCity?: string, limitCount: number = 10): Promise<Event[]> {
    const lastDoc = this.lastDocSubject.value;
    if (!lastDoc) return [];

    try {
      let q;
      
      if (userCity) {
        q = query(
          this.eventsCollection,
          where('location.city', '==', userCity),
          orderBy('eventDate', 'asc'),
          startAfter(lastDoc),
          limit(limitCount)
        );
      } else {
        q = query(
          this.eventsCollection,
          orderBy('eventDate', 'asc'),
          startAfter(lastDoc),
          limit(limitCount)
        );
      }

      const querySnapshot = await getDocs(q);
      const events: Event[] = [];
      const now = new Date();

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const eventDate = data['eventDate'].toDate();
        
        // Include the event if:
        // 1. It's an upcoming event (normal event)
        // 2. It's a recurring event (regardless of date)
        const isUpcomingEvent = eventDate >= now;
        const isRecurringEvent = data['isRecurring'] === true;
        
        if (isUpcomingEvent || isRecurringEvent) {
          events.push({
            ...data,
            eventId: doc.id,
            eventDate: eventDate
          } as Event);
        }
      });

      // Update the last document for next pagination
      if (querySnapshot.docs.length > 0) {
        this.lastDocSubject.next(querySnapshot.docs[querySnapshot.docs.length - 1]);
      }

      return events;
    } catch (error) {
      console.error('Error getting more events:', error);
      return [];
    }
  }

  async searchEvents(searchTerm: string): Promise<Event[]> {
    try {
      // Firebase doesn't support full-text search, so we'll search by event name
      // In a production app, you might want to use Algolia or similar service
      const q = query(
        this.eventsCollection,
        orderBy('eventDate', 'asc')
      );

      const querySnapshot = await getDocs(q);
      const events: Event[] = [];
      const now = new Date();

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const event = {
          ...data,
          eventId: doc.id,
          eventDate: data['eventDate'].toDate()
        } as Event;

        // Include the event if:
        // 1. It's an upcoming event (normal event)
        // 2. It's a recurring event (regardless of date)
        const isUpcomingEvent = event.eventDate >= now;
        const isRecurringEvent = event.isRecurring === true;
        
        if (isUpcomingEvent || isRecurringEvent) {
          // Client-side filtering for search term
          const searchLower = searchTerm.toLowerCase();
          if (
            event.eventName.toLowerCase().includes(searchLower) ||
            event.location.city.toLowerCase().includes(searchLower) ||
            event.location.state.toLowerCase().includes(searchLower)
          ) {
            events.push(event);
          }
        }
      });

      return events;
    } catch (error) {
      console.error('Error searching events:', error);
      return [];
    }
  }

  async joinEvent(eventId: string, userId: string): Promise<void> {
    const eventRef = doc(this.firestore, 'events', eventId);
    const userRef = doc(this.firestore, 'users', userId);

    await updateDoc(eventRef, {
      participants: arrayUnion(userId)
    });

    await updateDoc(userRef, {
      attendingEvents: arrayUnion(eventId)
    });
  }

  async leaveEvent(eventId: string, userId: string): Promise<void> {
    const eventRef = doc(this.firestore, 'events', eventId);
    const userRef = doc(this.firestore, 'users', userId);

    await updateDoc(eventRef, {
      participants: arrayRemove(userId)
    });

    await updateDoc(userRef, {
      attendingEvents: arrayRemove(eventId)
    });
  }

  async updateEvent(eventId: string, eventData: Partial<EventFormData>): Promise<void> {
    const eventRef = doc(this.firestore, 'events', eventId);
    
    // Prepare the update data, excluding undefined values
    const updateData: any = {};
    
    // Add fields that exist in eventData
    if (eventData.eventName !== undefined) updateData.eventName = eventData.eventName;
    if (eventData.location !== undefined) updateData.location = eventData.location;
    if (eventData.coordinates !== undefined) updateData.coordinates = eventData.coordinates;
    if (eventData.eventTime !== undefined) updateData.eventTime = eventData.eventTime;
    if (eventData.minAge !== undefined) updateData.minAge = eventData.minAge;
    if (eventData.details !== undefined) updateData.details = eventData.details;
    if (eventData.whatsappLink !== undefined) updateData.whatsappLink = eventData.whatsappLink;
    if (eventData.maxParticipants !== undefined) updateData.maxParticipants = eventData.maxParticipants;
    if (eventData.privacy !== undefined) updateData.privacy = eventData.privacy;
    if (eventData.imageUrl !== undefined) updateData.imageUrl = eventData.imageUrl;
    
    // Handle eventDate and time
    if (eventData.eventDate && eventData.eventTime) {
      updateData.eventDate = Timestamp.fromDate(new Date(eventData.eventDate + 'T' + eventData.eventTime));
    } else if (eventData.eventDate) {
      // If only date is provided, we need to preserve the time
      // This would require fetching the existing event first to get the time
    }
    
    // Add recurring event fields only if they exist
    if (eventData.isRecurring !== undefined) {
      updateData.isRecurring = eventData.isRecurring;
      
      if (eventData.recurrenceType !== undefined) {
        updateData.recurrenceType = eventData.recurrenceType;
      }
      
      if (eventData.weeklyDays !== undefined) {
        updateData.weeklyDays = eventData.weeklyDays;
      }
      
      if (eventData.monthlyDays !== undefined) {
        updateData.monthlyDays = eventData.monthlyDays;
      }
    }
    
    await updateDoc(eventRef, updateData);
  }

  async deleteEvent(eventId: string): Promise<void> {
    try {
      const eventRef = doc(this.firestore, 'events', eventId);
      
      // First, get the event to find the creator
      const eventDoc = await getDoc(eventRef);
      if (!eventDoc.exists()) {
        throw new Error('Event not found');
      }
      
      const eventData = eventDoc.data();
      const creatorId = eventData['creatorId'];
      
      // Remove event from creator's createdEvents array
      if (creatorId) {
        const userRef = doc(this.firestore, 'users', creatorId);
        await updateDoc(userRef, {
          createdEvents: arrayRemove(eventId)
        });
      }
      
      // Remove event from all participants' attendingEvents arrays
      const participants = eventData['participants'] || [];
      for (const participantId of participants) {
        try {
          const userRef = doc(this.firestore, 'users', participantId);
          await updateDoc(userRef, {
            attendingEvents: arrayRemove(eventId)
          });
        } catch (error) {
          console.warn(`Failed to remove event from user ${participantId}:`, error);
        }
      }
      
      // Delete the event document
      // Note: In a production app, you might want to mark as deleted instead of actually deleting
      await deleteDoc(eventRef);
    } catch (error) {
      console.error('Error deleting event:', error);
      throw error;
    }
  }

  async getUserEvents(userId: string): Promise<{ created: Event[], attending: Event[] }> {
    try {
      // Get user document to retrieve created and attending event IDs
      const userDoc = await getDoc(doc(this.firestore, 'users', userId));
      if (!userDoc.exists()) {
        throw new Error('User not found');
      }
      
      const userData = userDoc.data();
      const createdEventIds = userData['createdEvents'] || [];
      const attendingEventIds = userData['attendingEvents'] || [];
      
      // Get created events
      const createdEvents: Event[] = [];
      for (const eventId of createdEventIds) {
        try {
          const event = await this.getEvent(eventId);
          if (event) {
            createdEvents.push(event);
          }
        } catch (error) {
          console.warn(`Failed to load created event ${eventId}:`, error);
        }
      }
      
      // Get attending events
      const attendingEvents: Event[] = [];
      for (const eventId of attendingEventIds) {
        try {
          const event = await this.getEvent(eventId);
          if (event) {
            attendingEvents.push(event);
          }
        } catch (error) {
          console.warn(`Failed to load attending event ${eventId}:`, error);
        }
      }
      
      // Sort events by date (newest first)
      createdEvents.sort((a, b) => b.eventDate.getTime() - a.eventDate.getTime());
      attendingEvents.sort((a, b) => b.eventDate.getTime() - a.eventDate.getTime());
      
      return {
        created: createdEvents,
        attending: attendingEvents
      };
    } catch (error) {
      console.error('Error getting user events:', error);
      throw error;
    }
  }

  resetPagination(): void {
    this.lastDocSubject.next(null);
  }
}
