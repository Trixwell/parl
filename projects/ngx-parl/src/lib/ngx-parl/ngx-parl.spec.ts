import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NgxParl } from './ngx-parl';

describe('NgxParl', () => {
  let component: NgxParl;
  let fixture: ComponentFixture<NgxParl>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NgxParl]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NgxParl);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
