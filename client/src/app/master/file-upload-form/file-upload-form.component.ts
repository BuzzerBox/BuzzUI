// Based on https://github.com/progtarek/angular-drag-n-drop-directive
import {Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild} from '@angular/core';
import {IUploadFormData} from '../interfaces/IUploadFormData';

@Component({
  selector: 'app-file-upload-form',
  templateUrl: './file-upload-form.component.html',
  styleUrls: ['./file-upload-form.component.css']
})
export class FileUploadFormComponent implements OnInit {
  @ViewChild('fileDropRef', {static: false}) fileDropEl: ElementRef;
  @Output() data: EventEmitter<IUploadFormData> = new EventEmitter<IUploadFormData>();


  file: File;

  constructor() {
  }


  onFileDropped($event): void {
    this.prepareFilesList($event);
    this.data.emit({completed: true, type: 'file', data: this.file});
  }

  fileBrowseHandler(files): void {
    this.prepareFilesList(files);
    this.data.emit({completed: true, type: 'file', data: this.file});
  }

  deleteFile(): void {
    this.file = undefined;
    this.data.emit({completed: false, type: 'file', data: undefined});
  }


  prepareFilesList(files: Array<any>): void {
    for (const item of files) {
      item.progress = 0;
      this.file = item;
    }
    this.fileDropEl.nativeElement.value = '';
  }

  /**
   * format bytes
   * @param bytes (File size in bytes)
   * @param decimals (Decimals point)
   */
  formatBytes(bytes, decimals = 2): string {
    if (bytes === 0) {
      return '0 Bytes';
    }
    const k = 1024;
    const dm = decimals <= 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  ngOnInit(): void {
  }
}
