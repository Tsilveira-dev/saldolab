export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function mapDatabaseError(error) {
  if (error instanceof ApiError) return error;
  if (error?.code === '23503') return new ApiError(409, 'Este registro está vinculado a outros dados ou contém uma referência inválida.');
  if (error?.code === '23505') return new ApiError(409, 'Já existe um registro com essas informações.');
  if (error?.code === '23514' || error?.code === '23502' || error?.code === '22001') {
    return new ApiError(422, 'Os dados não atendem às regras financeiras.');
  }
  return new ApiError(500, 'Não foi possível concluir a operação. Tente novamente.');
}

export function jsonResponse(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      'Vary': 'Authorization',
    },
  });
}
