module Main where

import Prelude

import Control.Monad.Aff (Aff(), runAff)
import Control.Monad.Eff (Eff())
import Control.Monad.Eff.Exception (throwException)
import Control.Monad.Eff.Random
import Data.Array (alterAt, replicate)
import Data.Maybe
import Data.Traversable (sequence)

import Halogen
import Halogen.Util (appendToBody, onLoad)
import qualified Halogen.HTML.Core as C
import qualified Halogen.HTML.Indexed as H
import qualified Halogen.HTML.Properties.Indexed as P
import qualified Halogen.HTML.Events.Indexed as E

import Yahtzee


data Query a = ScoreQuery Category a
	     | Roll a
             | MarkDie Int a

type Die = { marked :: Boolean, value :: Int }
type ScoreField = { category :: Category, score :: Maybe Int }
type State = { dice :: Array Die, scores :: Array ScoreField }

initialState :: State
initialState = { dice: replicate 5 { marked: false, value: 1 },  -- initialState random?
                 scores: [ 
                           { category: Aces, score: Nothing },
                           { category: Twos, score: Just 123 }
                         ]
               }

ui :: forall eff. Component State Query (Aff (random::RANDOM | eff))
ui = component render eval
  where

  render :: State -> ComponentHTML Query
  render state =
    H.div_ [
      H.div_ [
        H.button [ E.onClick (E.input_ Roll) ] [ H.text "Würfeln" ]
      ],
      H.div_ (map renderDie state.dice),
      H.table_ [
        H.tbody_ (map renderScoreField state.scores)
      ]   
    ]

  renderDie die = H.img [ classes, onclick, (P.src ("Dice-" ++ show die.value ++ ".svg")) ]
    where
      classes = P.classes if die.marked then [ C.className "die", C.className "marked" ] else [ C.className "die" ]
      onclick = E.onClick (E.input_ (MarkDie 1))


  renderScoreField sf = H.tr_ [
                          H.td_ [ H.text (showCategory sf.category) ],
                          H.td props [ H.text label ]
                        ]
    where props = if isNothing sf.score then [ E.onClick (E.input_ (ScoreQuery sf.category)) ] else [] 
          label = show sf.score
          showCategory Aces = "Einser"
          showCategory Twos = "Zweier"
          showCategory _ = "not yet translated"

  eval :: Natural Query (ComponentDSL State Query (Aff (random::RANDOM | eff)))
  eval (Roll next) = do
    dice <- liftEff' (sequence (replicate 5 (randomInt 1 6)))
    modify (\state -> state { dice = map (\d -> { marked: false, value: d }) dice })
    pure next

  eval (MarkDie i next) = do
    modify (\state -> state { dice = fromMaybe state.dice (alterAt i (\die -> Just { marked: not die.marked, value: die.value }) state.dice) })
    pure next
    
  eval (ScoreQuery category next) = do
    modify (\state -> state { scores = map setScore state.scores })
    pure next
      where setScore sf = if sf.category == category then { category: category, score: Just 123 } else sf

main :: forall eff. Eff (HalogenEffects (random::RANDOM | eff)) Unit
main = runAff throwException (const (pure unit)) $ do
  ds <- liftEff' (sequence (replicate 5 (randomInt 1 6)))
  let dice = map (\d -> { marked: false, value: d }) ds 
  let x = (dice::(Array Die))
  let s = (initialState { dice = dice })::State
  app <- runUI ui s
  onLoad $ appendToBody app.node
