import { Injectable } from '@angular/core';
import { Storage, ref, uploadBytes, getDownloadURL, deleteObject } from '@angular/fire/storage';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  
  constructor(private storage: Storage) {}

  async uploadProfileImage(file: File, userId: string): Promise<string> {
    try {
      const filePath = `profile-images/${userId}/${Date.now()}_${file.name}`;
      const fileRef = ref(this.storage, filePath);
      
      const snapshot = await uploadBytes(fileRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      return downloadURL;
    } catch (error) {
      console.error('Error uploading profile image:', error);
      throw error;
    }
  }

  async uploadEventImage(file: File, eventId: string): Promise<string> {
    try {
      const filePath = `event-images/${eventId}/${Date.now()}_${file.name}`;
      const fileRef = ref(this.storage, filePath);
      
      const snapshot = await uploadBytes(fileRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      return downloadURL;
    } catch (error) {
      console.error('Error uploading event image:', error);
      throw error;
    }
  }

  async deleteImage(imageUrl: string): Promise<void> {
    try {
      const imageRef = ref(this.storage, imageUrl);
      await deleteObject(imageRef);
    } catch (error) {
      console.error('Error deleting image:', error);
      throw error;
    }
  }

  validateImageFile(file: File): boolean {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedTypes.includes(file.type)) {
      throw new Error('Tipo de arquivo não suportado. Use JPEG, JPG, PNG ou WebP.');
    }

    if (file.size > maxSize) {
      throw new Error('Arquivo muito grande. O tamanho máximo é 5MB.');
    }

    return true;
  }
}