import { Component, OnDestroy, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { Subscription, filter, fromEvent, merge, throttleTime } from 'rxjs';

import { AuthService, SESSION_IDLE_TIMEOUT_MS } from './features/auth/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly activitySubscription: Subscription;

  constructor() {
    this.activitySubscription = merge(
      fromEvent(document, 'pointerdown'),
      fromEvent(document, 'pointermove'),
      fromEvent(document, 'keydown'),
      fromEvent(document, 'touchstart'),
      fromEvent(document, 'wheel'),
      fromEvent(document, 'scroll', { capture: true }),
    )
      .pipe(throttleTime(1000))
      .subscribe(() => {
        this.auth.recordActivity();
        this.scheduleIdleTimeout();
      });

    this.scheduleIdleTimeout();
  }

  ngOnDestroy(): void {
    this.activitySubscription.unsubscribe();
    this.clearIdleTimer();
  }

  private scheduleIdleTimeout(): void {
    this.clearIdleTimer();
    if (!this.auth.isAuthenticated()) {
      return;
    }

    const remainingTime = this.auth.remainingIdleTime();
    if (remainingTime === 0) {
      this.expireSession();
      return;
    }

    this.idleTimer = setTimeout(() => this.expireSession(), remainingTime);
  }

  private expireSession(): void {
    this.idleTimer = null;
    if (!this.auth.isAuthenticated()) {
      return;
    }

    this.auth.expireSessionForIdle();
    void this.router.navigate(['/login'], { queryParams: { reason: 'idle' } });
  }

  private clearIdleTimer(): void {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }
}
