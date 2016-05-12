module Test.Yahtzee where

import Prelude (class Show, Unit, bind, return, show, (++), (==), (<<<), (||))
import Control.Monad.Eff.Console (print)
import Control.Monad.Eff.Unsafe (unsafePerformEff)
import Data.Array ((..), sort, nub, intersect)
import Data.Array.Unsafe (head, tail)
import Data.Foldable (any)
import Data.Maybe (Maybe(Just, Nothing))
import Test.Assert.Simple (assertEqual)
import Test.StrongCheck (class Arbitrary, QC, Result, (<?>), smallCheck, quickCheck)
import Test.StrongCheck.Gen (chooseInt, nChooseK, shuffleArray, vectorOf)
import Yahtzee (Category(Aces, Twos, ThreeOfAKind, FullHouse, SmallStraight, LargeStraight, Yahtzee, Chance), score)


tests :: QC Unit
tests = do
  assertEqual (score Aces [1,2,3,4,5]) (Just 1)
  assertEqual (score Aces [4,1,6,1,1]) (Just 3)
  assertEqual (score Twos [4,2,6,2,1]) (Just 4)
  
  assertEqual (score Twos [4,2,6,2,1]) (Just 4)

  assertEqual (score ThreeOfAKind [4,2,6,2,1]) Nothing
  assertEqual (score ThreeOfAKind [2,2,6,2,1]) (Just 13)

  assertEqual (score FullHouse [2,2,6,2,1]) Nothing
  assertEqual (score FullHouse [2,2,6,2,6]) (Just 25)
  smallCheck (propFullHouse :: FullHouseDice -> Result)

  assertEqual (score SmallStraight [4,1,4,3,2]) (Just 30)
  assertEqual (score SmallStraight [4,1,5,3,2]) (Just 30)
  assertEqual (score SmallStraight [5,1,5,3,2]) Nothing
  quickCheck propSmallStraight
  
  assertEqual (score LargeStraight [3,2,5,1,4]) (Just 40)
  assertEqual (score LargeStraight [1,2,3,4,6]) Nothing
  quickCheck propLargeStraight

  assertEqual (score Yahtzee [1,1,1,1,1]) (Just 50)
  quickCheck propYahtzee

  assertEqual (score Chance [1,1,3,4,6]) (Just 15)
  assertEqual (score Chance [1,1,1,1,1]) (Just 5)


data RandomDice = RandomDice (Array Int)
instance arbitraryRandomDice :: Arbitrary RandomDice where
  arbitrary = do dice <- vectorOf 5 (chooseInt 1.0 6.0)
		 return (RandomDice dice)

data FullHouseDice = FullHouseDice (Array Int)
instance arbitraryFullHouseDice :: Arbitrary FullHouseDice where
  arbitrary = do pair <- nChooseK 2 (1..6)
		 let p = pair :: Array Int
                 let d1 = head p
                 let d2 = head (tail p)
                 let dice = [d1, d1, d2, d2, d2]
                 shuffled <- shuffleArray dice
                 return (FullHouseDice shuffled)

propFullHouse :: FullHouseDice -> Result
propFullHouse (FullHouseDice dice) = let option = score FullHouse dice
       	                              in option == Just 25 <?> show dice ++ " made the test fail with output: " ++ show option

propSmallStraight :: RandomDice -> Result
propSmallStraight (RandomDice dice) = actual == expected <?> show dice ++ " actual=" ++ show actual
  where actual = score SmallStraight dice
        expected = if isSmallStraight then Just 30 else Nothing
        isSmallStraight = containsStraight [1,2,3,4] || containsStraight [2,3,4,5] || containsStraight [3,4,5,6]
        containsStraight straight = straight == (intersect (sort (nub dice)) straight)

propLargeStraight :: RandomDice -> Result
propLargeStraight (RandomDice dice) = actual == expected <?> show dice
  where actual = score LargeStraight dice
        expected = if (sort dice) == [1,2,3,4,5] || (sort dice) == [2,3,4,5,6] then Just 40 else Nothing

propYahtzee :: RandomDice -> Result
propYahtzee (RandomDice dice) = actual == expected <?> show dice
  where actual = score Yahtzee dice
	expected = if any (_ == dice) [[1,1,1,1,1], [2,2,2,2,2], [3,3,3,3,3], [4,4,4,4,4], [5,5,5,5,5], [6,6,6,6,6]] then Just 50 else Nothing

dbg :: forall a. (Show a) => a -> a
dbg = unsafePerformEff <<< printAndReturn
  where printAndReturn x = do print x
                              return x


