import {Directive, Input, ElementRef, Renderer, OnInit} from 'angular2/core';
import {Category} from './viewmodel';

@Directive({
  selector: '[scoreField]',
  host: {
    '(click)': 'onClick()'
  }
})
export class ScoreFieldDirective implements OnInit {
  @Input('scoreField') category;
  @Input('onClick') onClickCallback;
  constructor(private el: ElementRef, private renderer: Renderer) {
  }
  private _createText(el, text) {
    // this.renderer.createText(this.el, "hihihi");
    var textNode = document.createTextNode(text);
    el.nativeElement.appendChild(textNode);
  }
  private _render() {
    if (this.category.score) {
      this._createText(this.el, this.category.score);
      this._setCssClass(this.el, "scored");
    } else if (this.category.option) {
      this._createText(this.el, this.category.option);
      this._setCssClass(this.el, "legal-option");
    } else if (this.category.option == null) {
      this._createText(this.el, "-");
      this._setCssClass(this.el, "discard-option");
    }
  }
  private _setCssClass(el, className) {
    el.nativeElement.className = className;
  }
  ngOnInit() {
    this._render();
  }
  onClick() {
    this.onClickCallback(this.category);
  }
}
