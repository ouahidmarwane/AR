/** Erreurs applicatives portant un statut HTTP, levées par la couche d'accès aux données. */
export class AppError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** 401 : aucune session valide. */
export class UnauthenticatedError extends AppError {
  constructor(message = "Authentification requise") {
    super(message, 401);
  }
}

/** 403 : session valide mais accès refusé (autre organisation, rôle insuffisant...). */
export class ForbiddenError extends AppError {
  constructor(message = "Accès refusé") {
    super(message, 403);
  }
}

/** 404 : ressource absente OU appartenant à une autre organisation (on ne révèle pas laquelle). */
export class NotFoundError extends AppError {
  constructor(message = "Ressource introuvable") {
    super(message, 404);
  }
}
