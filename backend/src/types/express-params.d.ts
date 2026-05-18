/**
 * Express 5 changed req.params values to `string | string[]`.
 * At runtime they are always `string` for named route params (e.g. /:id).
 * This declaration overrides ParamsDictionary back to `Record<string, string>`
 * so existing routes compile without TS2322 errors.
 */
declare namespace Express {
  interface Request {
    params: Record<string, string>;
  }
}
