// src/types/formidable.d.ts
declare module "formidable" {
    // a small File shape used by the upload handler
    export type File = {
      filepath?: string;        // new formidable versions
      path?: string;            // older versions
      newFilename?: string;
      originalFilename?: string | null;
      size?: number;
      mimetype?: string | null;
    };
  
    export type Files = { [field: string]: File | File[] | undefined };
  
    // The default export (callable) and a named export
    // We don't try to type every method — use `any` for the instance.
    const formidable: any;
    export default formidable;
    export { formidable };
  }
  