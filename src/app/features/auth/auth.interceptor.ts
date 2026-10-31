import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { environment } from '../../environment';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.token();
  const isApiRequest = request.url.startsWith(`${environment.apiBaseUrl}/api/`);
  const isHandledDesignAccessRequest = /\/api\/projects\/\d+\/designs\/(?:file-roots(?:\/\d+)?|file-browser(?:\?|$)|parts\/\d+\/file(?:\/download)?(?:\?|$))/.test(request.url);
  const authorizedRequest = token && isApiRequest
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : request;

  return next(authorizedRequest).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        (error.status === 401 || error.status === 403) &&
        token &&
        !(error.status === 403 && isHandledDesignAccessRequest)
      ) {
        if (error.status === 401) {
          auth.clearSession();
          void router.navigateByUrl('/login');
        } else {
          void router.navigateByUrl('/access-denied');
        }
      }
      return throwError(() => error);
    }),
  );
};
