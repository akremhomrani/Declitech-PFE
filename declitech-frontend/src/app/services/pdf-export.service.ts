import { Injectable, inject } from '@angular/core';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { LoggerService } from './logger.service';

export interface PdfExportOptions {
  filename: string;
  renderWaitMs?: number;
  cloneWaitMs?: number;
}

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const DEFAULT_RENDER_WAIT_MS = 100;
const DEFAULT_CLONE_WAIT_MS = 150;

@Injectable({ providedIn: 'root' })
export class PdfExportService {
  private readonly logger = inject(LoggerService);

  async exportElementToPdf(element: HTMLElement, opts: PdfExportOptions): Promise<boolean> {
    const renderWait = opts.renderWaitMs ?? DEFAULT_RENDER_WAIT_MS;
    const cloneWait = opts.cloneWaitMs ?? DEFAULT_CLONE_WAIT_MS;

    try {
      await wait(renderWait);
      const clone = this.prepareClone(element);
      document.body.appendChild(clone);
      await wait(cloneWait);

      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: clone.scrollWidth,
        height: clone.scrollHeight,
        windowWidth: clone.scrollWidth,
        windowHeight: clone.scrollHeight
      });

      document.body.removeChild(clone);

      this.writeMultiPagePdf(canvas, opts.filename);
      return true;
    } catch (err) {
      this.logger.error('PDF export failed', err, { filename: opts.filename });
      return false;
    }
  }

  private prepareClone(source: HTMLElement): HTMLElement {
    const clone = source.cloneNode(true) as HTMLElement;

    clone.querySelectorAll('.print-header').forEach((el) => {
      (el as HTMLElement).style.display = 'flex';
      el.classList.remove('hidden');
    });

    clone.querySelectorAll('[data-html2canvas-ignore]').forEach((el) => {
      el.parentNode?.removeChild(el);
    });

    Object.assign(clone.style, {
      position: 'fixed',
      top: '0',
      left: '-9999px',
      width: source.scrollWidth + 'px',
      height: source.scrollHeight + 'px',
      maxHeight: 'none',
      overflow: 'visible',
      borderRadius: '0',
      zIndex: '-1',
      backgroundColor: '#ffffff'
    });

    return clone;
  }

  private writeMultiPagePdf(canvas: HTMLCanvasElement, filename: string): void {
    const imgWidth = A4_WIDTH_MM;
    const pageHeight = A4_HEIGHT_MM;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgData = canvas.toDataURL('image/png');

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position -= pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(filename);
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
