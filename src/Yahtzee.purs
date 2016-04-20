module Yahtzee where

import Prelude
import Data.Array
import Data.Foldable
import Data.Generic
import Data.Maybe
import Data.Lens


lensOnes :: Lens ScoreColumn ScoreColumn Score Score
lensOnes = lens (_.ones) (\sc s -> sc { ones = s })
lensTwos :: Lens ScoreColumn ScoreColumn Score Score
lensTwos = lens (_.twos) (\sc s -> sc { twos = s })
lensThrees :: Lens ScoreColumn ScoreColumn Score Score
lensThrees = lens (_.threes) (\sc s -> sc { threes = s })
lensFours :: Lens ScoreColumn ScoreColumn Score Score
lensFours = lens (_.fours) (\sc s -> sc { fours = s })
lensFives :: Lens ScoreColumn ScoreColumn Score Score
lensFives = lens (_.fives) (\sc s -> sc { fives = s })
lensSixes :: Lens ScoreColumn ScoreColumn Score Score
lensSixes = lens (_.sixes) (\sc s -> sc { sixes = s })
lensThreeOfAKind :: Lens ScoreColumn ScoreColumn Score Score
lensThreeOfAKind = lens (_.threeOfAKind) (\sc s -> sc { threeOfAKind = s })
lensFourOfAKind :: Lens ScoreColumn ScoreColumn Score Score
lensFourOfAKind = lens (_.fourOfAKind) (\sc s -> sc { fourOfAKind = s })
lensFullHouse :: Lens ScoreColumn ScoreColumn Score Score
lensFullHouse = lens (_.fullHouse) (\sc s -> sc { fullHouse = s })
lensSmallStraight :: Lens ScoreColumn ScoreColumn Score Score
lensSmallStraight = lens (_.smallStraight) (\sc s -> sc { smallStraight = s })
lensLargeStraigt :: Lens ScoreColumn ScoreColumn Score Score
lensLargeStraigt = lens (_.largeStraight) (\sc s -> sc { largeStraight = s })
lensYahtzee :: Lens ScoreColumn ScoreColumn Score Score
lensYahtzee = lens (_.yahtzee) (\sc s -> sc { yahtzee = s })
lensChance :: Lens ScoreColumn ScoreColumn Score Score
lensChance = lens (_.chance) (\sc s -> sc { chance = s })

data Category = Aces
              | Twos
              | Threes
              | Fours
              | Fives
              | Sixes
              | ThreeOfAKind
              | FourOfAKind
              | FullHouse
              | SmallStraight
              | LargeStraight
              | Yahtzee
              | Chance

derive instance genericCategory :: Generic Category
instance eqCategory :: Eq Category where
  eq = gEq
instance showCategory :: Show Category where
  show = gShow

type Score = { category :: Category, value :: Maybe Int }
type GameState = { sumUpperSection :: Int
                 , bonusUpperSection :: Int
                 , finalUpperSection :: Int
                 , sumLowerSection :: Int
                 , finalSum :: Int
                 , gameOver :: Boolean
                 } 
type ScoreColumn = { ones :: Score
                   , twos :: Score
                   , threes :: Score
                   , fours :: Score
                   , fives :: Score
                   , sixes :: Score
                   , threeOfAKind :: Score
                   , fourOfAKind :: Score
                   , fullHouse :: Score
                   , smallStraight :: Score
                   , largeStraight :: Score
                   , yahtzee :: Score
                   , chance :: Score
                   }

upperSectionCategories :: Array Category
upperSectionCategories = [ Aces, Twos, Threes, Fours, Fives, Sixes ]
lowerSectionCategories :: Array Category
lowerSectionCategories = [ ThreeOfAKind, FourOfAKind, FullHouse, SmallStraight, LargeStraight, Yahtzee, Chance ]
maxRerolls :: Int
maxRerolls = 2


recalculate :: Array Score -> ScoreColumn -> GameState
recalculate scores sc = { sumUpperSection: sumUpperSection
                     , bonusUpperSection: bonusUpperSection
                     , finalUpperSection: finalUpperSection
                     , sumLowerSection: sumLowerSection
                     , finalSum: finalSum
                     , gameOver: gameOver
                     }
  where
    gameOver = all (\s -> isJust s.value) scores
    sumUpperSection = sumSection upperSectionScores
    bonusUpperSection = if sumUpperSection >= 63 then 35 else 0
    finalUpperSection = sumUpperSection + bonusUpperSection
    sumLowerSection = sumSection lowerSectionScores
    finalSum = finalUpperSection + sumLowerSection
    sumSection scores = sum $ map (\s -> fromMaybe 0 s.value) scores
    upperSectionScores = [ sc.ones, sc.twos, sc.threes, sc.fours, sc.fives, sc.sixes ] :: Array Score
    lowerSectionScores = [ sc.threeOfAKind, sc.fourOfAKind, sc.fullHouse, sc.smallStraight, sc.largeStraight, sc.yahtzee, sc.chance ] :: Array Score


score :: Category -> Array Int -> Maybe Int
score Aces = scorePips 1
score Twos = scorePips 2
score Threes = scorePips 3
score Fours = scorePips 4
score Fives = scorePips 5
score Sixes = scorePips 6
score ThreeOfAKind = scoreKinds 3
score FourOfAKind = scoreKinds 4
score FullHouse = scoreFullHouse
score SmallStraight = scoreStraight 4
score LargeStraight = scoreStraight 5
score Yahtzee = scoreYahtzee
score Chance = (Just <<< sum)


scorePips :: Int -> Array Int -> Maybe Int
scorePips n dice = Just (sum (filter (==n) dice))

scoreKinds :: Int -> Array Int -> Maybe Int
scoreKinds n dice = if (isOfAKind dice) then Just (sum dice) else Nothing
  where isOfAKind = group' >>> map length >>> any (>=n)

scoreFullHouse :: Array Int -> Maybe Int
scoreFullHouse dice = if (isFullHouse dice) then Just 25 else Nothing
  where isFullHouse dice = (groupDice dice) == [2,3]
        groupDice        = group' >>> map length >>> sort

scoreStraight :: Int -> Array Int -> Maybe Int
scoreStraight n dice = if isStraight then points n else Nothing
  where isStraight = any (\die -> all (`elem` dice) (straightStartingFrom die)) dice
        straightStartingFrom die = (die..(die+n-1))
        points 4 = Just 30
        points 5 = Just 40
        points _ = Nothing

scoreYahtzee :: Array Int -> Maybe Int
scoreYahtzee dice = if isYahtzee then Just 50 else Nothing
  where isYahtzee = length (group dice) == 1
