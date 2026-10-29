import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    const queryParams: Record<string, string> = { returnUrl: state.url };
    if (auth.sessionExpiredByIdle()) {
      queryParams['reason'] = 'idle';
    }
    return router.createUrlTree(['/login'], { queryParams });
  }

  const permission = route.data['permission'] as string | undefined;
  return !permission || auth.hasPermission(permission)
    ? true
    : router.createUrlTree(['/access-denied']);
};
