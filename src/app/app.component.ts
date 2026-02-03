import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FileUploadComponent } from './components/file-upload/file-upload.component';
import { TissEditorComponent } from './components/tiss-editor/tiss-editor.component';
import { NfseParserService, NfseData, TissManualData } from './services/nfse-parser.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FileUploadComponent, TissEditorComponent],
  templateUrl: './app.component.html',
  styles: []
})
export class AppComponent {
  step: 'upload' | 'processing' | 'edit' = 'upload';
  parsedData: NfseData | null = null;
  
  constructor(private nfseParser: NfseParserService) {}

  async onFileSelected(file: File) {
    this.step = 'processing';
    
    setTimeout(async () => {
      const text = await file.text();
      const result = this.nfseParser.parse(text);
      if (result) {
        this.parsedData = result;
        this.step = 'edit';
      } else {
        alert('Erro ao processar o arquivo. Verifique se é um XML de NFS-e válido.');
        this.step = 'upload';
      }
    }, 800);
  }

  onGenerate(manualData: TissManualData) {
    if (!this.parsedData) return;
    
    const xmlTiss = this.nfseParser.generateTiss(this.parsedData, manualData);
    // Adiciona timestamp para evitar cache no upload
    this.downloadFile(xmlTiss, `tiss-${new Date().getTime()}.xml`);
  }

  onCancel() {
    this.parsedData = null;
    this.step = 'upload';
  }

  private downloadFile(content: string, filename: string) {
    // CORREÇÃO: Força charset ISO-8859-1 para garantir compatibilidade com portais legados
    const blob = new Blob([content], { type: 'text/xml;charset=iso-8859-1' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  }
}