import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PreviewFile } from './preview-file';

describe('PreviewFile', () => {
  let component: PreviewFile;
  let fixture: ComponentFixture<PreviewFile>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PreviewFile]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PreviewFile);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
