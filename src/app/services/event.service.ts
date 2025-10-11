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
    const eventDoc = {
      ...eventData,
      eventDate: Timestamp.fromDate(new Date(eventData.eventDate + 'T' + eventData.eventTime)),
      participants: [],
      creatorId,
      creatorName,
      creatorPhotoURL,
      createdAt: Timestamp.now()
    };

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
        q = query(
          this.eventsCollection,
          where('location.city', '==', userCity),
          where('eventDate', '>=', Timestamp.now()),
          orderBy('eventDate', 'asc'),
          limit(limitCount)
        );
      } else {
        // If no city provided, get all upcoming events
        q = query(
          this.eventsCollection,
          where('eventDate', '>=', Timestamp.now()),
          orderBy('eventDate', 'asc'),
          limit(limitCount)
        );
      }

      const querySnapshot = await getDocs(q);
      const events: Event[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        events.push({
          ...data,
          eventId: doc.id,
          eventDate: data['eventDate'].toDate()
        } as Event);
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
          where('eventDate', '>=', Timestamp.now()),
          orderBy('eventDate', 'asc'),
          startAfter(lastDoc),
          limit(limitCount)
        );
      } else {
        q = query(
          this.eventsCollection,
          where('eventDate', '>=', Timestamp.now()),
          orderBy('eventDate', 'asc'),
          startAfter(lastDoc),
          limit(limitCount)
        );
      }

      const querySnapshot = await getDocs(q);
      const events: Event[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        events.push({
          ...data,
          eventId: doc.id,
          eventDate: data['eventDate'].toDate()
        } as Event);
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
        where('eventDate', '>=', Timestamp.now()),
        orderBy('eventDate', 'asc')
      );

      const querySnapshot = await getDocs(q);
      const events: Event[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const event = {
          ...data,
          eventId: doc.id,
          eventDate: data['eventDate'].toDate()
        } as Event;

        // Client-side filtering for search term
        const searchLower = searchTerm.toLowerCase();
        if (
          event.eventName.toLowerCase().includes(searchLower) ||
          event.location.city.toLowerCase().includes(searchLower) ||
          event.location.state.toLowerCase().includes(searchLower)
        ) {
          events.push(event);
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
    
    if (eventData.eventDate && eventData.eventTime) {
      const updateData = {
        ...eventData,
        eventDate: Timestamp.fromDate(new Date(eventData.eventDate + 'T' + eventData.eventTime))
      };
      await updateDoc(eventRef, updateData);
    } else {
      await updateDoc(eventRef, eventData);
    }
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
