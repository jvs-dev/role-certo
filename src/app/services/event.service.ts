import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, doc, getDoc, getDocs, query, 
         where, orderBy, limit, updateDoc, arrayUnion, arrayRemove, 
         startAfter, DocumentSnapshot, Timestamp } from '@angular/fire/firestore';
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

  async getUserEvents(userId: string): Promise<{ created: Event[], attending: Event[] }> {
    try {
      // Get created events (without orderBy to avoid index requirements)
      const createdQuery = query(
        this.eventsCollection,
        where('creatorId', '==', userId)
      );

      // Get attending events (without orderBy to avoid index requirements)
      const attendingQuery = query(
        this.eventsCollection,
        where('participants', 'array-contains', userId)
      );

      const [createdSnapshot, attendingSnapshot] = await Promise.all([
        getDocs(createdQuery),
        getDocs(attendingQuery)
      ]);

      const created: Event[] = [];
      const attending: Event[] = [];

      createdSnapshot.forEach((doc) => {
        const data = doc.data();
        created.push({
          ...data,
          eventId: doc.id,
          eventDate: data['eventDate'].toDate()
        } as Event);
      });

      attendingSnapshot.forEach((doc) => {
        const data = doc.data();
        attending.push({
          ...data,
          eventId: doc.id,
          eventDate: data['eventDate'].toDate()
        } as Event);
      });

      // Sort client-side by eventDate desc
      created.sort((a, b) => b.eventDate.getTime() - a.eventDate.getTime());
      attending.sort((a, b) => b.eventDate.getTime() - a.eventDate.getTime());

      return { created, attending };
    } catch (error) {
      console.error('Error getting user events:', error);
      return { created: [], attending: [] };
    }
  }

  resetPagination(): void {
    this.lastDocSubject.next(null);
  }
}