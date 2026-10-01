import { it, expect } from "vitest";
import PDFDocument from "pdfkit";
import { reviewReadablePdf } from "./kycPdfReview.js";
const pdf = (text) => new Promise(resolve=>{
  const chunks=[],doc=new PDFDocument({compress:false});
  doc.on('data',chunk=>chunks.push(chunk));doc.on('end',()=>resolve(Buffer.concat(chunks)));
  if(text)doc.fontSize(18).text(text);else doc.rect(50,50,100,100).fill('gray');
  doc.end();
});
it.each([
  ['GST Certificate','GST Registration Certificate\nGSTIN 27ABCDE1234F1Z5',{gstNumber:'27ABCDE1234F1Z5'}],
  ['Trade Licence','Municipal Corporation TRADE LICENCE\nLicence Number: TL-12345',{tradeLicenceNumber:'TL-12345'}],
])('reads actual embedded-text %s PDFs',async(type,text,fields)=>{
  await expect(reviewReadablePdf(await pdf(text),type)).resolves.toEqual({match:'match',fields});
},20000);
it('rejects image-only/unreadable PDF rather than accepting metadata',async()=>{
  await expect(reviewReadablePdf(await pdf(''),'GST Certificate')).rejects.toThrow();
  await expect(reviewReadablePdf(Buffer.from('not a pdf'),'GST Certificate')).rejects.toThrow();
},20000);
it('does not accept unrelated embedded text as GST',async()=>{
  const result=await reviewReadablePdf(await pdf('INCOME TAX PERMANENT ACCOUNT NUMBER ABCDE1234F'),'GST Certificate');
  expect(result.match).toBe('mismatch');expect(result.fields).toEqual({});
},20000);
