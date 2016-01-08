import {Component} from 'angular2/core';
import {ScoreFieldComponent} from './score-field.component';

@Component({
  directives: [ScoreFieldComponent],
  selector: 'game',
  templateUrl: 'app/game.component.html'
})
export class GameComponent {
  public categories = {
    'Aces': 123,
    'Twos': 456
  };
}
