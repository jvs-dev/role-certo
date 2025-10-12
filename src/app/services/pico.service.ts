import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, doc, getDoc, getDocs, query, 
         where, orderBy, updateDoc, arrayUnion, deleteDoc, Timestamp, setDoc } from '@angular/fire/firestore';
import { Observable, from } from 'rxjs';
import { Pico, PicoFormData, Review, ReviewFormData } from '../models/interfaces';

@Injectable({
  providedIn: 'root'
})
export class PicoService {
  private picosCollection;

  constructor(private firestore: Firestore) {
    this.picosCollection = collection(this.firestore, 'picos');
  }

  async createPico(picoData: PicoFormData, creatorId: string, creatorName: string): Promise<string> {
    const picoDoc = {
      ...picoData,
      creatorId,
      creatorName,
      photos: picoData.photos || [],
      averageRating: 0,
      ratingCount: 0,
      createdAt: Timestamp.now()
    };

    const docRef = await addDoc(this.picosCollection, picoDoc);
    
    // Update pico document with its own ID
    await updateDoc(docRef, { picoId: docRef.id });

    return docRef.id;
  }

  async getPico(picoId: string): Promise<Pico | null> {
    try {
      const picoDoc = await getDoc(doc(this.firestore, 'picos', picoId));
      if (picoDoc.exists()) {
        const data = picoDoc.data();
        return {
          ...data,
          picoId: picoDoc.id
        } as Pico;
      }
      return null;
    } catch (error) {
      console.error('Error getting pico:', error);
      return null;
    }
  }

  async getAllPicos(): Promise<Pico[]> {
    try {
      const q = query(this.picosCollection, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const picos: Pico[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        picos.push({
          ...data,
          picoId: doc.id
        } as Pico);
      });

      return picos;
    } catch (error) {
      console.error('Error getting picos:', error);
      return [];
    }
  }

  async searchPicos(searchTerm: string): Promise<Pico[]> {
    try {
      const q = query(this.picosCollection, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const picos: Pico[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const pico = {
          ...data,
          picoId: doc.id
        } as Pico;

        // Client-side filtering for search term
        const searchLower = searchTerm.toLowerCase();
        if (pico.picoName.toLowerCase().includes(searchLower)) {
          picos.push(pico);
        }
      });

      return picos;
    } catch (error) {
      console.error('Error searching picos:', error);
      return [];
    }
  }

  async getPicosSortedByRating(): Promise<Pico[]> {
    try {
      const allPicos = await this.getAllPicos();
      // Sort by average rating (descending) and then by rating count (descending)
      return allPicos.sort((a, b) => {
        if (b.averageRating !== a.averageRating) {
          return b.averageRating - a.averageRating;
        }
        return b.ratingCount - a.ratingCount;
      });
    } catch (error) {
      console.error('Error getting picos sorted by rating:', error);
      return [];
    }
  }

  async addReview(picoId: string, reviewData: ReviewFormData, userId: string, userName: string, userPhotoURL: string): Promise<void> {
    try {
      const reviewDoc = {
        ...reviewData,
        userId,
        userName,
        userPhotoURL,
        createdAt: Timestamp.now()
      };

      const reviewsCollection = collection(this.firestore, 'picos', picoId, 'reviews');
      const reviewRef = await addDoc(reviewsCollection, reviewDoc);
      
      // Update review document with its own ID
      await updateDoc(reviewRef, { reviewId: reviewRef.id });

      // Update pico's average rating and rating count
      await this.updatePicoRating(picoId);
    } catch (error) {
      console.error('Error adding review:', error);
      throw error;
    }
  }

  async updatePicoRating(picoId: string): Promise<void> {
    try {
      // Get all reviews for this pico
      const reviewsCollection = collection(this.firestore, 'picos', picoId, 'reviews');
      const q = query(reviewsCollection);
      const querySnapshot = await getDocs(q);
      
      let totalRating = 0;
      let ratingCount = querySnapshot.size;
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        totalRating += data['rating'];
      });
      
      const averageRating = ratingCount > 0 ? totalRating / ratingCount : 0;
      
      // Update pico document
      const picoRef = doc(this.firestore, 'picos', picoId);
      await updateDoc(picoRef, {
        averageRating,
        ratingCount
      });
    } catch (error) {
      console.error('Error updating pico rating:', error);
      throw error;
    }
  }

  async getUserReview(picoId: string, userId: string): Promise<Review | null> {
    try {
      const reviewsCollection = collection(this.firestore, 'picos', picoId, 'reviews');
      const q = query(reviewsCollection, where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        const data = doc.data();
        return {
          ...data,
          reviewId: doc.id
        } as Review;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting user review:', error);
      return null;
    }
  }

  async getAllReviews(picoId: string): Promise<Review[]> {
    try {
      const reviewsCollection = collection(this.firestore, 'picos', picoId, 'reviews');
      const q = query(reviewsCollection, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const reviews: Review[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        reviews.push({
          ...data,
          reviewId: doc.id
        } as Review);
      });

      return reviews;
    } catch (error) {
      console.error('Error getting reviews:', error);
      return [];
    }
  }

  async updatePico(picoId: string, picoData: Partial<PicoFormData>): Promise<void> {
    const picoRef = doc(this.firestore, 'picos', picoId);
    await updateDoc(picoRef, picoData);
  }

  async deletePico(picoId: string): Promise<void> {
    try {
      const picoRef = doc(this.firestore, 'picos', picoId);
      
      // Delete all reviews first
      const reviewsCollection = collection(this.firestore, 'picos', picoId, 'reviews');
      const reviewsSnapshot = await getDocs(reviewsCollection);
      
      for (const reviewDoc of reviewsSnapshot.docs) {
        await deleteDoc(reviewDoc.ref);
      }
      
      // Delete the pico document
      await deleteDoc(picoRef);
    } catch (error) {
      console.error('Error deleting pico:', error);
      throw error;
    }
  }
}