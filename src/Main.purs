module Main where

import Prelude

import Control.Monad.Aff (Aff())
import Control.Monad.Aff.Free (fromEff)
import Control.Monad.Eff (Eff())
import Control.Monad.Eff.Random
import Data.Array (alterAt, length, range, replicate, zip)
import Data.Foldable (all, any, find, sum)
import Data.Maybe
import Data.String (joinWith)
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
             , games :: Array Y.GameState
             }
type Die = { marked :: Boolean, value :: Int }

data Query a = Score Y.Category Y.GameState a
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
      H.button [ E.onClick (E.input_ Reroll), P.enabled (rerollsAllowed && anyDieMarked && not gameOver) ] [ H.text "Markierte Würfel nochmal werfen" ],
      H.p_ [ H.text if rerollsAllowed
                    then "Noch " ++ show rerollsPossible ++ " Wiederholungs" ++ (if rerollsPossible == 1 then "wurf" else "würfe") ++ " möglich"
                    else "Alle Würfe sind aufgebraucht - eine Kategorie werten oder streichen!"
      ],
      H.table_ [
        H.tbody_ $ [ constraintsRow
                   , scoreRow "Einser" Y.Aces
                   , scoreRow "Zweier" Y.Twos
                   , scoreRow "Dreier" Y.Threes
                   , scoreRow "Vierer" Y.Fours
                   , scoreRow "Fünfer" Y.Fives
                   , scoreRow "Sechser" Y.Sixes
                   , calculatedRow "Zwischensumme" (_.sumUpperSection)
                   , calculatedRow "Bonus" (_.bonusUpperSection)
                   , calculatedRow "Zwischensumme oberer Teil" (_.finalUpperSection)
                   , scoreRow "Dreierpasch" Y.ThreeOfAKind
                   , scoreRow "Viererpasch" Y.FourOfAKind
                   , scoreRow "Full House" Y.FullHouse
                   , scoreRow "Kleine Straße" Y.SmallStraight
                   , scoreRow "Große Straße" Y.LargeStraight
                   , scoreRow "Yahtzee!" Y.Yahtzee
                   , scoreRow "Chance" Y.Chance
                   , calculatedRow "Zwischensumme unterer Teil" (_.sumLowerSection)
                   , calculatedRow "Endsumme" (_.finalSum)
                   , finalRow
                   ]
      ],
      H.p_ [ legend Y.Descending, H.br_, legend Y.Ascending, H.br_, legend Y.NoRerolls ],
      H.p_ if gameOver then [ H.button [ E.onClick (E.input_ Restart) ] [ H.text "Neues Spiel" ] ] else []
    ]
    where
    showConstraint Y.NoRerolls = "1"
    showConstraint Y.Ascending = "^"
    showConstraint Y.Descending = "v"
    legend Y.NoRerolls = H.text $ showConstraint Y.NoRerolls ++ " = keine Wiederholungswürfe erlaubt"
    legend Y.Ascending = H.text $ showConstraint Y.Ascending ++ " = muss von unten nach oben gewertet werden"
    legend Y.Descending = H.text $ showConstraint Y.Descending ++ " = muss von oben nach unten gewertet werden"
    finalRow = H.tr_ [ H.td_ [ H.text "Gesamtsumme" ]
                     , H.td [ P.colSpan 6 ] [ H.text $ show $ sum $ map (_.finalSum) state.games ]
                     ]
    constraintsRow = H.tr_ ([
                       H.td_ []
                     ] ++ map (\game -> renderConstraints game.constraints) state.games)
      where renderConstraints constraints = H.td_ [ H.text $ joinWith "" $ map showConstraint constraints ]
    calculatedRow label getter = H.tr_ ([
                                   H.td_ [ H.text label ]
                                 ] ++ map (\game -> H.td_ [ H.text $ show $ getter game ]) state.games)
    scoreRow label category = H.tr_ ([
                                H.td_ [ H.text label ]
                              ] ++ map (\game -> scoreCell game) state.games)
      where scoreCell game = let maybeFind = find (\sf -> sf.category == category) game.scores
                                 scoreState = fromMaybe (Y.Option Nothing) $ map (_.state) $ maybeFind
                                 showJust maybe = fromMaybe "-" $ map show maybe
                                 onclick = E.onClick (E.input_ (Score category game))
                              in case scoreState of
              Y.Scored maybe ->    H.td [ P.classes [ C.className "scored" ] ] [ H.text $ showJust maybe ]
              Y.Option (Just o) -> H.td [ onclick, P.classes [ C.className "option" ] ] [ H.text $ show o ]
              Y.Option Nothing ->  H.td [ onclick, P.classes [ C.className "discard" ] ] [ H.text "-" ]
    gameOver = all (_.gameOver) state.games
    rerollsAllowed = state.rerolls < Y.maxRerolls
    rerollsPossible = Y.maxRerolls - state.rerolls
    anyDieMarked = any (\d -> d.marked) state.dice
    renderDieWithIndex (Tuple die i) = H.img [ classes, onclick, (P.src ("Dice-" ++ show die.value ++ ".svg")) ]
      where
      classes = P.classes ([ C.className "die" ] ++ if die.marked then [ C.className "marked" ] else [])
      onclick = E.onClick (E.input_ (MarkDie i))

  eval :: Natural Query (ComponentDSL State Query (Aff (AppEffects eff)))
  eval (Reroll next) = do
    ds <- fromEff randomPips5
    modify (\state -> let calculation = Y.recalculateHardcore state.games newRerolls newDs
                          newRerolls = state.rerolls + 1
                          newDice = map merge (zip state.dice ds)
                          newDs = map (_.value) newDice
                          merge (Tuple die d) = if die.marked then { marked: false, value: d } else die
                       in { dice: newDice, games: calculation, rerolls: newRerolls })
    pure next

  eval (MarkDie i next) = do
    modify (\state -> state { dice = if state.rerolls < Y.maxRerolls then toggleDie i state.dice else state.dice })
    pure next
      where toggleDie i dice = fromMaybe dice (alterAt i (\die -> Just die { marked = not die.marked }) dice) 
    
  eval (Score category game next) = do
    ds <- fromEff randomPips5
    modify (updateScores ds)
    pure next
      where
      updateScores ds state = { dice: pipsToDice ds
                              , rerolls: 0
                              , games: calculation
                              }
        where calculation = Y.recalculateHardcore newGames 0 ds
              newGames = map (\g -> if g.constraints == game.constraints then newGame else g) state.games
                                    -- assuming constraints are unique for all games
              newGame = game { scores = newScores }
              newScores = map setScore game.scores
              setScore sf = if sf.category == category
                            then { category, state: Y.Scored $ Y.scoreHardcore game state.rerolls category (map (_.value) state.dice) }
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
                          constraints = [ []
                                        , [ Y.Descending ]
                                        , [ Y.Ascending ]
                                        , [ Y.NoRerolls ]
                                        , [ Y.NoRerolls, Y.Descending ]
                                        , [ Y.NoRerolls, Y.Ascending ]
                                        ] 
                          initialScores = map (\c -> {category: c, state: Y.Option Nothing}) categories
                          initialGameStates = map (\c -> { constraints: c
                                                         , scores: initialScores
                                                         , sumUpperSection: 0
                                                         , bonusUpperSection: 0
                                                         , finalUpperSection: 0
                                                         , sumLowerSection: 0
                                                         , finalSum: 0
                                                         , gameOver: false
                                                 }) constraints
                          calculation = Y.recalculateHardcore initialGameStates 0 ds
                       in { dice: pipsToDice ds
                          , rerolls: 0
                          , games: calculation
                          }

main :: forall eff. Eff (AppEffects (eff)) Unit
main = runHalogenAff do
  ds <- fromEff randomPips5
  let initialState = makeInitialState ds
  body <- awaitBody
  runUI ui initialState body
