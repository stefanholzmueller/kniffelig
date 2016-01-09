import {Directive, Input, ElementRef, Renderer, OnInit} from 'angular2/core';
import {Category} from './viewmodel';

@Directive({
  selector: '[scoreField]'
})
export class ScoreFieldDirective implements OnInit {
  @Input('scoreField') category;
  constructor(private el: ElementRef, private renderer: Renderer) {
  }
  private _render() {
    // this.renderer.createText(this.el, "hihihi");
    var textNode = document.createTextNode(this.category.value);
    this.el.nativeElement.appendChild(textNode);
  }
  ngOnInit() {
    this._render();
  }
}
