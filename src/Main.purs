module Main where

import Prelude

import Control.Monad.Aff (Aff())
import Control.Monad.Aff.Free (fromEff)
import Control.Monad.Eff (Eff())
import Control.Monad.Eff.Random
import Data.Array (alterAt, filter, length, range, replicate, zip)
import Data.Foldable (any, find)
import Data.Maybe
import Data.Traversable (sequence)
import Data.Tuple

import Halogen
import Halogen.Util (awaitBody, runHalogenAff)
import qualified Halogen.HTML.Core as C
import qualified Halogen.HTML.Indexed as H
import qualified Halogen.HTML.Events.Indexed as E
import qualified Halogen.HTML.Properties.Indexed as P

import qualified Yahtzee as Y


type AppEffects eff = HalogenEffects (random :: RANDOM | eff)
type State = { dice :: Array Die
             , rerolls :: Int
             , game :: Y.GameState
             }
type Die = { marked :: Boolean, value :: Int }

data Query a = Score Y.Category a
	     | Reroll a
             | MarkDie Int a
             | Restart a

ui :: forall eff. Component State Query (Aff (AppEffects eff))
ui = component { render, eval }
  where
  render :: State -> ComponentHTML Query
  render state =
    H.div_ [
      H.div_ (map renderDieWithIndex (zipWithIndex state.dice)),
      H.button [ E.onClick (E.input_ Reroll), P.enabled (rerollsAllowed && anyDieMarked) ] [ H.text "Markierte Würfel nochmal werfen" ],
      H.p_ [ H.text if rerollsAllowed
                    then "Noch " ++ show rerollsPossible ++ " Wiederholungs" ++ (if rerollsPossible == 1 then "wurf" else "würfe") ++ " möglich"
                    else "Alle Würfe sind aufgebraucht - eine Kategorie werten oder streichen!"
      ],
      H.table_ [
        H.tbody_ $ [ scoreRow "Einser" Y.Aces
                   , scoreRow "Zweier" Y.Twos
                   , scoreRow "Dreier" Y.Threes
                   , scoreRow "Vierer" Y.Fours
                   , scoreRow "Fünfer" Y.Fives
                   , scoreRow "Sechser" Y.Sixes
                   , calculatedRow "Zwischensumme" state.game.sumUpperSection
                   , calculatedRow "Bonus" state.game.bonusUpperSection
                   , calculatedRow "Zwischensumme oberer Teil" state.game.finalUpperSection
                   , scoreRow "Dreierpasch" Y.ThreeOfAKind
                   , scoreRow "Viererpasch" Y.FourOfAKind
                   , scoreRow "Full House" Y.FullHouse
                   , scoreRow "Kleine Straße" Y.SmallStraight
                   , scoreRow "Große Straße" Y.LargeStraight
                   , scoreRow "Yahtzee!" Y.Yahtzee
                   , scoreRow "Chance" Y.Chance
                   , calculatedRow "Zwischensumme unterer Teil" state.game.sumLowerSection
                   , calculatedRow "Endsumme" state.game.finalSum
                   ]
      ],
      H.p_ if state.game.gameOver then [ H.button [ E.onClick (E.input_ Restart) ] [ H.text "Neues Spiel" ] ] else []
    ]
    where
    calculatedRow label score = H.tr_ [
                                  H.td_ [ H.text label ],
                                  H.td_ [ H.text $ show score ]
                                ]
    scoreRow label category = H.tr_ [
                                H.td_ [ H.text label ],
         case scoreState of
           Y.Scored maybe ->    H.td [ P.classes [ C.className "scored" ] ] [ H.text $ showJust maybe ]
           Y.Option (Just o) -> H.td [ onclick, P.classes [ C.className "option" ] ] [ H.text $ show o ]
           Y.Option Nothing ->  H.td [ onclick, P.classes [ C.className "discard" ] ] [ H.text "-" ]
                              ]
      where onclick = E.onClick (E.input_ (Score category))
            showJust maybe = fromMaybe "-" $ map show maybe
            scoreState = fromMaybe (Y.Option Nothing) $ map (_.state) $ maybeFind
            maybeFind = find (\sf -> sf.category == category) state.game.scoreColumn.scores
    rerollsAllowed = state.rerolls < Y.maxRerolls
    rerollsPossible = Y.maxRerolls - state.rerolls
    anyDieMarked = any (\d -> d.marked) state.dice
    upperSectionScores = filterForCategories Y.upperSectionCategories state.game.scoreColumn.scores
    lowerSectionScores = filterForCategories Y.lowerSectionCategories state.game.scoreColumn.scores
    filterForCategories categories = filter (\sf -> any (==sf.category) categories)
    renderDieWithIndex (Tuple die i) = H.img [ classes, onclick, (P.src ("Dice-" ++ show die.value ++ ".svg")) ]
      where
      classes = P.classes ([ C.className "die" ] ++ if die.marked then [ C.className "marked" ] else [])
      onclick = E.onClick (E.input_ (MarkDie i))

  eval :: Natural Query (ComponentDSL State Query (Aff (AppEffects eff)))
  eval (Reroll next) = do
    ds <- fromEff randomPips5
    modify (\state -> let calculation = Y.recalculate state.game.scoreColumn.scores newDs
                          newDice = map merge (zip state.dice ds)
                          newDs = map (_.value) newDice
                          merge (Tuple die d) = if die.marked then { marked: false, value: d } else die
                      in state { dice = newDice, game = calculation, rerolls = state.rerolls + 1 })
    pure next

  eval (MarkDie i next) = do
    modify (\state -> state { dice = if state.rerolls < Y.maxRerolls then toggleDie i state.dice else state.dice })
    pure next
      where toggleDie i dice = fromMaybe dice (alterAt i (\die -> Just die { marked = not die.marked }) dice) 
    
  eval (Score category next) = do
    ds <- fromEff randomPips5
    modify (updateScores ds)
    pure next
      where
      updateScores ds state = { dice: pipsToDice ds
                              , rerolls: 0
                              , game: calculation
                              }
        where calculation = Y.recalculate newScores ds
              newScores = map setScore state.game.scoreColumn.scores
              setScore sf = if sf.category == category
                            then { category: category, state: Y.Scored $ Y.score category (map (_.value) state.dice) }
                            else sf

  eval (Restart next) = do
    ds <- fromEff randomPips5
    modify (\state -> makeInitialState ds)
    pure next
    
zipWithIndex :: forall a. Array a -> Array (Tuple a Int)
zipWithIndex array = zip array (range 0 (length array))

randomPips5 :: forall eff. Eff (random :: RANDOM | eff) (Array Int)
randomPips5 = sequence (replicate 5 (randomInt 1 6))

pipsToDice :: Array Int -> Array Die
pipsToDice = map (\d -> { marked: false, value: d })

makeInitialState :: Array Int -> State
makeInitialState ds = let categories = Y.upperSectionCategories ++ Y.lowerSectionCategories
                          calculation = Y.recalculate (map (\c -> {category: c, state: Y.Option Nothing}) categories) ds
                       in { dice: pipsToDice ds
                          , rerolls: 0
                          , game: calculation
                          }

main :: forall eff. Eff (AppEffects (eff)) Unit
main = runHalogenAff do
  ds <- fromEff randomPips5
  let initialState = makeInitialState ds
  body <- awaitBody
  runUI ui initialState body
