import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NgxParlComponent } from './ngx-parl';

describe('NgxParlComponent', () => {
  let component: NgxParlComponent;
  let fixture: ComponentFixture<NgxParlComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NgxParlComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NgxParlComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
