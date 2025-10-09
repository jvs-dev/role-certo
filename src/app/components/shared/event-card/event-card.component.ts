import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Event } from '../../../models/interfaces';

@Component({
  selector: 'app-event-card',
  imports: [CommonModule, RouterModule],
  templateUrl: './event-card.component.html',
  styleUrl: './event-card.component.scss'
})
export class EventCardComponent {
  @Input() event!: Event;

  getParticipantsText(): string {
    const current = this.event.participants.length;
    const max = this.event.maxParticipants;
    return `${current}/${max} participantes`;
  }

  getEventDate(): string {
    return this.event.eventDate.toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: 'short'
    });
  }

  getEventTime(): string {
    return this.event.eventTime;
  }

  isEventFull(): boolean {
    return this.event.participants.length >= this.event.maxParticipants;
  }

  getEventLocation(): string {
    return `${this.event.location.city}, ${this.event.location.state}`;
  }
}
