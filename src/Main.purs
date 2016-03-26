module Main where

import Prelude

import Control.Monad.Aff (Aff())
import Control.Monad.Aff.Free (fromEff)
import Control.Monad.Eff (Eff())
import Control.Monad.Eff.Random
import Data.Array (alterAt, length, range, replicate, zip)
import Data.Maybe
import Data.Traversable (sequence)
import Data.Tuple

import Halogen
import Halogen.Util (awaitBody, runHalogenAff)
import qualified Halogen.HTML.Core as C
import qualified Halogen.HTML.Indexed as H
import qualified Halogen.HTML.Properties.Indexed as P
import qualified Halogen.HTML.Events.Indexed as E

import Yahtzee


type AppEffects eff = HalogenEffects (random :: RANDOM | eff)
type State = { dice :: Array Die, scores :: Array ScoreField }
type Die = { marked :: Boolean, value :: Int }
type ScoreField = { category :: Category, score :: Maybe Int }

data Query a = ScoreQuery Category a
	     | Roll a
             | MarkDie Int a


ui :: forall eff. Component State Query (Aff (AppEffects eff))
ui = component { render, eval }
  where

  render :: State -> ComponentHTML Query
  render state =
    H.div_ [
      H.div_ [
        H.button [ E.onClick (E.input_ Roll) ] [ H.text "Würfeln" ]
      ],
      H.div_ (map renderDieWithIndex (zipWithIndex state.dice)),
      H.table_ [
        H.tbody_ (map renderScoreField state.scores)
      ]   
    ]

  renderDieWithIndex (Tuple die i) = H.img [ classes, onclick, (P.src ("Dice-" ++ show die.value ++ ".svg")) ]
    where
      classes = P.classes if die.marked then [ C.className "die", C.className "marked" ] else [ C.className "die" ]
      onclick = E.onClick (E.input_ (MarkDie i))


  renderScoreField sf = H.tr_ [
                          H.td_ [ H.text (showCategory sf.category) ],
                          H.td props [ H.text label ]
                        ]
    where props = if isNothing sf.score then [ E.onClick (E.input_ (ScoreQuery sf.category)) ] else [] 
          label = show sf.score
          showCategory Aces = "Einser"
          showCategory Twos = "Zweier"
          showCategory _ = "not yet translated"

  eval :: Natural Query (ComponentDSL State Query (Aff (AppEffects eff)))
  eval (Roll next) = do
    ds <- fromEff (sequence (replicate 5 (randomInt 1 6)))
    modify (_ { dice = map (\d -> { marked: false, value: d }) ds })
    pure next

  eval (MarkDie i next) = do
    modify (\state -> state { dice = fromMaybe state.dice (alterAt i (\die -> Just { marked: not die.marked, value: die.value }) state.dice) })
    pure next
    
  eval (ScoreQuery category next) = do
    modify (\state -> state { scores = map setScore state.scores })
    pure next
      where setScore sf = if sf.category == category then { category: category, score: Just 123 } else sf

zipWithIndex :: forall a. Array a -> Array (Tuple a Int)
zipWithIndex array = zip array (range 0 (length array))


main :: forall eff. Eff (AppEffects (eff)) Unit
main = runHalogenAff do
  ds <- fromEff (sequence (replicate 5 (randomInt 1 6)))
  let initialState = { dice: map (\d -> { marked: false, value: d }) ds,
                       scores: [ 
                           { category: Aces, score: Nothing },
                           { category: Twos, score: Just 123 }
                       ]
                     }
  body <- awaitBody
  runUI ui initialState body
